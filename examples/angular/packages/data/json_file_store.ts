import { randomUUID } from "node:crypto";
import {
  type FileHandle,
  mkdir,
  open,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";

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

async function ensureFileExists<T>(options: JsonFileStoreOptions<T>): Promise<void> {
  await mkdir(dirname(options.filePath), { recursive: true });

  try {
    await readFile(options.filePath, "utf8");
  } catch (error: unknown) {
    if (!isMissingFile(error)) {
      throw error;
    }

    await writeJsonAtomically(options.filePath, options.fallbackData);
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

async function writeJsonAtomically(filePath: string, value: unknown): Promise<void> {
  const tempFilePath = `${filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  const content = `${JSON.stringify(value, null, 2)}\n`;

  let renamed = false;

  try {
    await writeFile(tempFilePath, content, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(tempFilePath, filePath);
    renamed = true;
  } finally {
    if (!renamed) {
      await unlink(tempFilePath).catch((error: unknown) => {
        if (!isMissingFile(error)) {
          throw error;
        }
      });
    }
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

export function createJsonFileStore<T>(
  options: JsonFileStoreOptions<T>
): JsonFileStore<T> {
  let operationQueue = Promise.resolve();
  const lockFilePath = `${options.filePath}.lock`;

  function serialize<TResult>(
    operation: () => Promise<TResult>
  ): Promise<TResult> {
    const nextOperation = operationQueue.then(operation, operation);
    operationQueue = nextOperation.then(
      () => undefined,
      () => undefined
    );
    return nextOperation;
  }

  async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  function isLockBusy(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "EEXIST"
    );
  }

  async function cleanupStaleLock(maxAgeMs: number): Promise<void> {
    try {
      const lockStats = await stat(lockFilePath);

      if (Date.now() - lockStats.mtimeMs > maxAgeMs) {
        await unlink(lockFilePath).catch((error: unknown) => {
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
    operation: () => Promise<TResult>
  ): Promise<TResult> {
    const timeoutMs = 5_000;
    const retryDelayMs = 25;
    const staleLockMs = 30_000;
    const startedAt = Date.now();

    while (true) {
      await mkdir(dirname(lockFilePath), { recursive: true });

      let handle: FileHandle;
      try {
        handle = await open(lockFilePath, "wx");
      } catch (error: unknown) {
        if (!isLockBusy(error)) {
          throw error;
        }

        await cleanupStaleLock(staleLockMs);

        if (Date.now() - startedAt >= timeoutMs) {
          throw new Error(
            `Timed out acquiring JsonFileStore lock for ${options.filePath}`
          );
        }

        await sleep(retryDelayMs);
        continue;
      }

      try {
        await handle.writeFile(
          JSON.stringify({
            pid: process.pid,
            acquiredAt: new Date().toISOString(),
          }),
          "utf8"
        );
      } catch (error: unknown) {
        await handle.close().catch(() => undefined);
        await unlink(lockFilePath).catch((cleanupError: unknown) => {
          if (!isMissingFile(cleanupError)) {
            throw cleanupError;
          }
        });
        throw error;
      }

      await handle.close();

      try {
        return await operation();
      } finally {
        await unlink(lockFilePath).catch((error: unknown) => {
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
