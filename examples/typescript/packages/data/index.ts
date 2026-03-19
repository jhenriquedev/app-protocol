import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createJsonBoardStore } from "./json_board_store";

export type StudioStatus = "backlog" | "active" | "complete";

export interface StudioRecord {
  id: string;
  title: string;
  description?: string;
  status: StudioStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudioRecordInput {
  title: string;
  description?: string;
}

export interface BoardStore {
  list(): Promise<StudioRecord[]>;
  create(input: CreateStudioRecordInput): Promise<StudioRecord>;
  move(id: string, status: StudioStatus): Promise<StudioRecord>;
  clear(): Promise<void>;
}

export interface DataPackage {
  rootDirectory: string;
  files: {
    board: string;
  };
  boardStore: BoardStore;
}

export async function ensureDataDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
}

export function createDataPackage(dataDirectory?: string): DataPackage {
  const rootDirectory = resolve(dataDirectory ?? join(process.cwd(), "packages/data"));
  const board = join(rootDirectory, "items.json");

  const boardStore = createJsonBoardStore({
    filePath: board,
    createId: () =>
      `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    ensureDirectory: async () => {
      await ensureDataDirectory(dirname(board));
    },
  });

  return {
    rootDirectory,
    files: {
      board,
    },
    boardStore,
  };
}
