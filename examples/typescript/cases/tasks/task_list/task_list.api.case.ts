import { BaseApiCase, type ApiContext, type ApiResponse } from "../../../core/api.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";
import {
  TaskListDomain,
  type TaskListInput,
  type TaskListItem,
  type TaskListOutput,
} from "./task_list.domain.case";

interface BoardStoreContract {
  list(): Promise<TaskListItem[]>;
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
      "task_list.api requires ctx.packages.data.boardStore"
    );
  }

  return store;
}

export class TaskListApi extends BaseApiCase<TaskListInput, TaskListOutput> {
  private readonly taskListDomain = new TaskListDomain();

  public async handler(input: TaskListInput): Promise<ApiResponse<TaskListOutput>> {
    return this.execute(input);
  }

  protected async _validate(input: TaskListInput): Promise<void> {
    this.taskListDomain.validate?.(input);
  }

  protected _repository(): BoardStoreContract {
    return getBoardStore(this.ctx);
  }

  protected async _service(): Promise<TaskListOutput> {
    return {
      items: await this._repository().list(),
    };
  }

  public async test(): Promise<void> {
    const api = new TaskListApi({
      correlationId: "test-task-list-api",
      logger: console,
      packages: {
        data: {
          boardStore: {
            list: async () => [
              {
                id: "item_listed",
                title: "Review portal layout",
                status: "active",
                createdAt: "2026-03-18T12:00:00.000Z",
                updatedAt: "2026-03-18T12:10:00.000Z",
              },
            ],
          },
        },
      },
    });

    const result = await api.handler({});
    if (!result.success || !result.data || result.data.items.length !== 1) {
      throw new Error("task_list.api test expected a single returned item");
    }
  }
}
