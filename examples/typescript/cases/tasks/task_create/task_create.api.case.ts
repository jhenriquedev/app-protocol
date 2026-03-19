import { BaseApiCase, type ApiContext, type ApiResponse } from "../../../core/api.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";
import {
  TaskCreateDomain,
  type TaskCreateInput,
  type TaskCreateOutput,
} from "./task_create.domain.case";

interface BoardStoreContract {
  create(input: {
    title: string;
    description?: string;
  }): Promise<TaskCreateOutput>;
}

type ExpectedPackagesMap = {
  data?: {
    boardStore?: BoardStoreContract;
  };
};

function getBoardStore(ctx: ApiContext): BoardStoreContract {
  const store = (ctx.packages as ExpectedPackagesMap | undefined)?.data?.boardStore;
  if (!store) {
    throw new AppCaseError(
      "INTERNAL",
      "task_create.api requires ctx.packages.data.boardStore"
    );
  }

  return store;
}

export class TaskCreateApi extends BaseApiCase<TaskCreateInput, TaskCreateOutput> {
  private readonly taskCreateDomain = new TaskCreateDomain();

  public async handler(input: TaskCreateInput): Promise<ApiResponse<TaskCreateOutput>> {
    return this.execute(input);
  }

  protected async _validate(input: TaskCreateInput): Promise<void> {
    this.taskCreateDomain.validate?.(input);
  }

  protected _repository(): BoardStoreContract {
    return getBoardStore(this.ctx);
  }

  protected async _service(input: TaskCreateInput): Promise<TaskCreateOutput> {
    return this._repository().create({
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
    });
  }

  public async test(): Promise<void> {
    const created: TaskCreateOutput[] = [];
    const api = new TaskCreateApi({
      correlationId: "test-task-create-api",
      logger: console,
      packages: {
        data: {
          boardStore: {
            create: async (input: {
              title: string;
              description?: string;
            }) => {
              const result: TaskCreateOutput = {
                id: "item_created",
                title: input.title,
                description: input.description,
                status: "backlog",
                createdAt: "2026-03-18T12:00:00.000Z",
                updatedAt: "2026-03-18T12:00:00.000Z",
              };
              created.push(result);
              return result;
            },
          },
        },
      },
    });

    const result = await api.handler({
      title: "Capture onboarding notes",
      description: "Summarize decisions from the onboarding workshop.",
    });

    if (!result.success || !result.data || created.length !== 1) {
      throw new Error("task_create.api test expected a persisted work item");
    }
  }
}
