import { dirname } from "@std/path";

export interface JsonFileStore<T> {
  filePath: string;
  read(): Promise<T>;
  write(value: T): Promise<void>;
  reset(): Promise<void>;
  update(updater: (current: T) => T | Promise<T>): Promise<T>;
}

export interface JsonFileStoreOptions<T> {
  filePath: string;
  fallbackData: T;
}

async function ensureFileExists<T>(
  options: JsonFileStoreOptions<T>,
): Promise<void> {
  await Deno.mkdir(dirname(options.filePath), { recursive: true });

  try {
    await Deno.stat(options.filePath);
  } catch (error: unknown) {
    if (!isMissingFile(error)) {
      throw error;
    }

    await writeJsonAtomically(options.filePath, options.fallbackData);
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Deno.errors.NotFound;
}

function isFileAlreadyExists(error: unknown): boolean {
  return error instanceof Deno.errors.AlreadyExists;
}

async function writeJsonAtomically(
  filePath: string,
  value: unknown,
): Promise<void> {
  const tempFilePath =
    `${filePath}.${Deno.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`;
  const content = `${JSON.stringify(value, null, 2)}\n`;

  let renamed = false;

  try {
    await Deno.writeTextFile(tempFilePath, content, {
      createNew: true,
    });
    await Deno.rename(tempFilePath, filePath);
    renamed = true;
  } finally {
    if (!renamed) {
      await Deno.remove(tempFilePath).catch((error: unknown) => {
        if (!isMissingFile(error)) {
          throw error;
        }
      });
    }
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await Deno.readTextFile(filePath);
  return JSON.parse(content) as T;
}

export function createJsonFileStore<T>(
  options: JsonFileStoreOptions<T>,
): JsonFileStore<T> {
  let operationQueue = Promise.resolve();
  const lockFilePath = `${options.filePath}.lock`;

  function serialize<TResult>(
    operation: () => Promise<TResult>,
  ): Promise<TResult> {
    const nextOperation = operationQueue.then(operation, operation);
    operationQueue = nextOperation.then(
      () => undefined,
      () => undefined,
    );
    return nextOperation;
  }

  async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  function isLockBusy(error: unknown): boolean {
    return isFileAlreadyExists(error);
  }

  async function cleanupStaleLock(maxAgeMs: number): Promise<void> {
    try {
      const lockStats = await Deno.stat(lockFilePath);
      const modifiedAt = lockStats.mtime?.getTime() ?? Date.now();

      if (Date.now() - modifiedAt > maxAgeMs) {
        await Deno.remove(lockFilePath).catch((error: unknown) => {
          if (!isMissingFile(error)) {
            throw error;
          }
        });
      }
    } catch (error: unknown) {
      if (!isMissingFile(error)) {
        throw error;
      }
    }
  }

  async function withFileLock<TResult>(
    operation: () => Promise<TResult>,
  ): Promise<TResult> {
    const timeoutMs = 5_000;
    const retryDelayMs = 25;
    const staleLockMs = 30_000;
    const startedAt = Date.now();

    while (true) {
      await Deno.mkdir(dirname(lockFilePath), { recursive: true });

      let handle: Deno.FsFile;
      try {
        handle = await Deno.open(lockFilePath, {
          createNew: true,
          write: true,
        });
      } catch (error: unknown) {
        if (!isLockBusy(error)) {
          throw error;
        }

        await cleanupStaleLock(staleLockMs);

        if (Date.now() - startedAt >= timeoutMs) {
          throw new Error(
            `Timed out acquiring JsonFileStore lock for ${options.filePath}`,
          );
        }

        await sleep(retryDelayMs);
        continue;
      }

      try {
        const payload = JSON.stringify(
          {
            pid: Deno.pid,
            acquiredAt: new Date().toISOString(),
          },
          null,
          2,
        );
        await handle.write(new TextEncoder().encode(payload));
      } catch (error: unknown) {
        handle.close();
        await Deno.remove(lockFilePath).catch((cleanupError: unknown) => {
          if (!isMissingFile(cleanupError)) {
            throw cleanupError;
          }
        });
        throw error;
      }

      handle.close();

      try {
        return await operation();
      } finally {
        await Deno.remove(lockFilePath).catch((error: unknown) => {
          if (!isMissingFile(error)) {
            throw error;
          }
        });
      }
    }
  }

  return {
    filePath: options.filePath,

    async read(): Promise<T> {
      return serialize(async () => {
        return withFileLock(async () => {
          await ensureFileExists(options);
          return readJsonFile<T>(options.filePath);
        });
      });
    },

    async write(value: T): Promise<void> {
      return serialize(async () => {
        return withFileLock(async () => {
          await ensureFileExists(options);
          await writeJsonAtomically(options.filePath, value);
        });
      });
    },

    async reset(): Promise<void> {
      return serialize(async () => {
        return withFileLock(async () => {
          await ensureFileExists(options);
          await writeJsonAtomically(options.filePath, options.fallbackData);
        });
      });
    },

    async update(updater: (current: T) => T | Promise<T>): Promise<T> {
      return serialize(async () => {
        return withFileLock(async () => {
          await ensureFileExists(options);

          const current = await readJsonFile<T>(options.filePath);
          const next = await updater(current);

          if (next !== current) {
            await writeJsonAtomically(options.filePath, next);
          }

          return next;
        });
      });
    },
  };
}
