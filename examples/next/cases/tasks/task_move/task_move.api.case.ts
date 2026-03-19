import {
  type ApiContext,
  type ApiResponse,
  BaseApiCase,
} from "../../../core/api.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";
import {
  assertTaskRecord,
  TaskMoveDomain,
  type Task,
  type TaskMoveInput,
  type TaskMoveOutput,
} from "./task_move.domain.case";

interface TaskStore {
  read(): Promise<Task[]>;
  write(value: Task[]): Promise<void>;
  reset?(): Promise<void>;
  update(updater: (current: Task[]) => Task[] | Promise<Task[]>): Promise<Task[]>;
}

interface ApiExtraProviders {
  taskStore?: TaskStore;
}

interface ApiExtraShape {
  providers?: ApiExtraProviders;
}

function mapErrorCodeToStatus(code?: string): number {
  switch (code) {
    case "VALIDATION_FAILED":
      return 400;
    case "NOT_FOUND":
      return 404;
    default:
      return 500;
  }
}

export class TaskMoveApi extends BaseApiCase<TaskMoveInput, TaskMoveOutput> {
  private readonly domainCase = new TaskMoveDomain();

  public async handler(
    input: TaskMoveInput
  ): Promise<ApiResponse<TaskMoveOutput>> {
    const result = await this.execute(input);

    if (result.success) {
      return {
        ...result,
        statusCode: 200,
      };
    }

    return {
      ...result,
      statusCode: mapErrorCodeToStatus(result.error?.code),
    };
  }

  public router(): unknown {
    return {
      method: "PATCH",
      path: "/tasks/:taskId/status",
      handler: (request: {
        params?: Record<string, string>;
        body?: { targetStatus?: TaskMoveInput["targetStatus"] };
      }) =>
        this.handler({
          taskId: request.params?.taskId ?? "",
          targetStatus: request.body?.targetStatus as TaskMoveInput["targetStatus"],
        }),
    };
  }

  public async test(): Promise<void> {
    const taskStore = this.resolveTaskStore();
    await taskStore.reset?.();

    await taskStore.write([
      {
        id: "task_001",
        title: "Ship the Next.js example",
        status: "todo",
        createdAt: "2026-03-18T12:00:00.000Z",
        updatedAt: "2026-03-18T12:00:00.000Z",
      },
    ]);

    const movedResult = await this.handler({
      taskId: "task_001",
      targetStatus: "doing",
    });

    if (!movedResult.success || !movedResult.data) {
      throw new Error("test: move should return success");
    }

    if (movedResult.data.task.status !== "doing") {
      throw new Error("test: task status must change to doing");
    }

    const persisted = await taskStore.read();
    if (persisted[0]?.status !== "doing") {
      throw new Error("test: moved status must persist");
    }

    const idempotentResult = await this.handler({
      taskId: "task_001",
      targetStatus: "doing",
    });
    if (!idempotentResult.success || !idempotentResult.data) {
      throw new Error("test: idempotent move should still succeed");
    }

    const notFoundResult = await this.handler({
      taskId: "missing",
      targetStatus: "done",
    });
    if (notFoundResult.success || notFoundResult.statusCode !== 404) {
      throw new Error("test: missing task must return NOT_FOUND");
    }

    await taskStore.write([
      {
        id: "task_002",
        title: "Broken task",
        description: 123,
        status: "todo",
        createdAt: "2026-03-18T12:00:00.000Z",
        updatedAt: "2026-03-18T12:00:00.000Z",
      } as unknown as Task,
    ]);

    const invalidPersistedResult = await this.handler({
      taskId: "task_002",
      targetStatus: "doing",
    });
    if (invalidPersistedResult.success || invalidPersistedResult.statusCode !== 500) {
      throw new Error("test: invalid persisted task must return failure");
    }
  }

  protected async _validate(input: TaskMoveInput): Promise<void> {
    try {
      this.domainCase.validate(input);
    } catch (error: unknown) {
      throw new AppCaseError(
        "VALIDATION_FAILED",
        error instanceof Error ? error.message : "task_move validation failed"
      );
    }
  }

  protected _repository(): TaskStore {
    return this.resolveTaskStore();
  }

  protected async _service(input: TaskMoveInput): Promise<TaskMoveOutput> {
    const taskStore = this.resolveTaskStore();
    let output: TaskMoveOutput | undefined;
    let previousStatus: Task["status"] | undefined;

    await taskStore.update((tasks) => {
      const taskIndex = tasks.findIndex((task) => task.id === input.taskId);

      if (taskIndex < 0) {
        throw new AppCaseError(
          "NOT_FOUND",
          `Task ${input.taskId} was not found`
        );
      }

      const currentTask = tasks[taskIndex]!;
      try {
        assertTaskRecord(currentTask, "task_move.persisted_task");
      } catch (error: unknown) {
        throw new AppCaseError(
          "INTERNAL",
          error instanceof Error
            ? error.message
            : "Persisted task data is invalid"
        );
      }

      if (currentTask.status === input.targetStatus) {
        output = { task: currentTask };
        this.domainCase.validateOutput(output);
        return tasks;
      }

      previousStatus = currentTask.status;
      const updatedTask: Task = {
        id: currentTask.id,
        title: currentTask.title,
        description: currentTask.description,
        status: input.targetStatus,
        createdAt: currentTask.createdAt,
        updatedAt: new Date().toISOString(),
      };

      output = { task: updatedTask };
      this.domainCase.validateOutput(output);

      const updatedTasks = [...tasks];
      updatedTasks[taskIndex] = updatedTask;
      return updatedTasks;
    });

    if (!output) {
      throw new AppCaseError(
        "INTERNAL",
        "task_move did not produce an output"
      );
    }

    if (previousStatus) {
      this.ctx.logger.info("task_move: task status updated", {
        taskId: output.task.id,
        from: previousStatus,
        to: output.task.status,
      });
    }

    return output;
  }

  private resolveTaskStore(): TaskStore {
    const extra = this.ctx.extra as ApiExtraShape | undefined;
    const taskStore = extra?.providers?.taskStore;

    if (!taskStore) {
      throw new AppCaseError(
        "INTERNAL",
        "task_move requires a configured taskStore provider"
      );
    }

    return taskStore;
  }
}
