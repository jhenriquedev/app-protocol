import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { createJsonFileStore, type JsonFileStore } from "./json_file_store";

export interface DataPackage {
  defaultFiles: {
    tasks: string;
  };
  createJsonFileStore: typeof createJsonFileStore;
}

export function createDataPackage(baseDirectory?: string): DataPackage {
  const resolvedBaseDirectory =
    baseDirectory ?? fileURLToPath(new URL(".", import.meta.url));

  return {
    defaultFiles: {
      tasks: join(resolvedBaseDirectory, "tasks.json"),
    },
    createJsonFileStore,
  };
}

export { createJsonFileStore };
export type { JsonFileStore };
