import { BaseApiCase, type ApiContext, type ApiResponse } from "../../../core/api.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";
import {
  TaskMoveDomain,
  type TaskMoveInput,
  type TaskMoveOutput,
} from "./task_move.domain.case";

interface BoardStoreContract {
  move(id: string, status: TaskMoveInput["targetStatus"]): Promise<TaskMoveOutput>;
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
      "task_move.api requires ctx.packages.data.boardStore"
    );
  }

  return store;
}

export class TaskMoveApi extends BaseApiCase<TaskMoveInput, TaskMoveOutput> {
  private readonly taskMoveDomain = new TaskMoveDomain();

  public async handler(input: TaskMoveInput): Promise<ApiResponse<TaskMoveOutput>> {
    return this.execute(input);
  }

  protected async _validate(input: TaskMoveInput): Promise<void> {
    this.taskMoveDomain.validate?.(input);
  }

  protected _repository(): BoardStoreContract {
    return getBoardStore(this.ctx);
  }

  protected async _service(input: TaskMoveInput): Promise<TaskMoveOutput> {
    try {
      return await this._repository().move(input.itemId.trim(), input.targetStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown board-store failure";
      if (message.includes("not found")) {
        throw new AppCaseError("NOT_FOUND", message, {
          itemId: input.itemId,
        });
      }

      throw error;
    }
  }

  public async test(): Promise<void> {
    const api = new TaskMoveApi({
      correlationId: "test-task-move-api",
      logger: console,
      packages: {
        data: {
          boardStore: {
            move: async (
              id: string,
              status: TaskMoveInput["targetStatus"]
            ) => ({
              id,
              title: "Moved item",
              status,
              createdAt: "2026-03-18T12:00:00.000Z",
              updatedAt: "2026-03-18T12:40:00.000Z",
            }),
          },
        },
      },
    });

    const result = await api.handler({
      itemId: "item_movable",
      targetStatus: "active",
    });

    if (!result.success || result.data?.status !== "active") {
      throw new Error("task_move.api test expected an active result");
    }
  }
}
