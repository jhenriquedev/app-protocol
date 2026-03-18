import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
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
  const tempFilePath = `${filePath}.tmp`;
  const content = `${JSON.stringify(value, null, 2)}\n`;

  await writeFile(tempFilePath, content, "utf8");
  await rename(tempFilePath, filePath);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

export function createJsonFileStore<T>(
  options: JsonFileStoreOptions<T>
): JsonFileStore<T> {
  let operationQueue = Promise.resolve();

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

  return {
    filePath: options.filePath,

    async read(): Promise<T> {
      return serialize(async () => {
        await ensureFileExists(options);
        return readJsonFile<T>(options.filePath);
      });
    },

    async write(value: T): Promise<void> {
      return serialize(async () => {
        await ensureFileExists(options);
        await writeJsonAtomically(options.filePath, value);
      });
    },

    async reset(): Promise<void> {
      return serialize(async () => {
        await ensureFileExists(options);
        await writeJsonAtomically(options.filePath, options.fallbackData);
      });
    },

    async update(updater: (current: T) => T | Promise<T>): Promise<T> {
      return serialize(async () => {
        await ensureFileExists(options);

        const current = await readJsonFile<T>(options.filePath);
        const next = await updater(current);

        if (next !== current) {
          await writeJsonAtomically(options.filePath, next);
        }

        return next;
      });
    },
  };
}
