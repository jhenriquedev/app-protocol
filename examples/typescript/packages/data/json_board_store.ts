import { readFile, writeFile } from "node:fs/promises";
import type {
  BoardStore,
  CreateStudioRecordInput,
  StudioRecord,
  StudioStatus,
} from "./index";

interface JsonBoardStoreOptions {
  filePath: string;
  createId: () => string;
  ensureDirectory: () => Promise<void>;
}

function isStatus(value: unknown): value is StudioStatus {
  return value === "backlog" || value === "active" || value === "complete";
}

function normalizeRecord(input: unknown): StudioRecord | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Partial<StudioRecord>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    !isStatus(candidate.status) ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    title: candidate.title,
    description:
      typeof candidate.description === "string" && candidate.description.length > 0
        ? candidate.description
        : undefined,
    status: candidate.status,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
}

async function readRecords(filePath: string): Promise<StudioRecord[]> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeRecord)
      .filter((record): record is StudioRecord => record !== null);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeRecords(filePath: string, records: StudioRecord[]): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

export function createJsonBoardStore(options: JsonBoardStoreOptions): BoardStore {
  let operationChain = Promise.resolve();

  const queue = async <T>(work: () => Promise<T>): Promise<T> => {
    const run = operationChain.then(work, work);
    operationChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };

  const load = async () => {
    await options.ensureDirectory();
    return readRecords(options.filePath);
  };

  return {
    async list() {
      return queue(async () => {
        const records = await load();
        return [...records].sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt)
        );
      });
    },

    async create(input: CreateStudioRecordInput) {
      return queue(async () => {
        const records = await load();
        const now = new Date().toISOString();
        const created: StudioRecord = {
          id: options.createId(),
          title: input.title,
          description: input.description,
          status: "backlog",
          createdAt: now,
          updatedAt: now,
        };

        await writeRecords(options.filePath, [...records, created]);
        return created;
      });
    },

    async move(id: string, status: StudioStatus) {
      return queue(async () => {
        const records = await load();
        const current = records.find((record) => record.id === id);

        if (!current) {
          throw new Error(`Board item ${id} was not found`);
        }

        const updated: StudioRecord = {
          ...current,
          status,
          updatedAt: new Date().toISOString(),
        };

        await writeRecords(
          options.filePath,
          records.map((record) => (record.id === id ? updated : record))
        );

        return updated;
      });
    },

    async clear() {
      return queue(async () => {
        await options.ensureDirectory();
        await writeRecords(options.filePath, []);
      });
    },
  };
}
