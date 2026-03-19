import {
  type ApiContext,
  type ApiResponse,
  BaseApiCase,
} from "../../../core/api.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";
import {
  TaskListDomain,
  assertTaskCollection,
  type Task,
  type TaskListInput,
  type TaskListOutput,
} from "./task_list.domain.case";

interface TaskStore {
  read(): Promise<Task[]>;
  write(value: Task[]): Promise<void>;
  reset?(): Promise<void>;
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
    default:
      return 500;
  }
}

export class TaskListApi extends BaseApiCase<TaskListInput, TaskListOutput> {
  private readonly domainCase = new TaskListDomain();

  public async handler(
    input: TaskListInput = {}
  ): Promise<ApiResponse<TaskListOutput>> {
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
      method: "GET",
      path: "/tasks",
      handler: () => this.handler({}),
    };
  }

  public async test(): Promise<void> {
    const taskStore = this.resolveTaskStore();
    await taskStore.reset?.();

    await taskStore.write([
      {
        id: "task_001",
        title: "Older task",
        status: "todo",
        createdAt: "2026-03-18T12:00:00.000Z",
        updatedAt: "2026-03-18T12:00:00.000Z",
      },
      {
        id: "task_002",
        title: "Newer task",
        status: "doing",
        createdAt: "2026-03-18T12:30:00.000Z",
        updatedAt: "2026-03-18T12:30:00.000Z",
      },
    ]);

    const result = await this.handler({});
    if (!result.success || !result.data) {
      throw new Error("test: handler should return a successful task list");
    }

    if (result.data.tasks.length !== 2) {
      throw new Error("test: task list should return all persisted tasks");
    }

    if (result.data.tasks[0]?.id !== "task_002") {
      throw new Error("test: task list should sort by createdAt descending");
    }

    let threw = false;
    try {
      await taskStore.write([
        {
          id: "broken",
          title: "Broken task",
          status: "broken",
          createdAt: "2026-03-18T12:00:00.000Z",
          updatedAt: "2026-03-18T12:00:00.000Z",
        } as unknown as Task,
      ]);
      const invalidResult = await this.handler({});
      if (invalidResult.success) {
        throw new Error("test: invalid persisted records must return failure");
      }
    } catch (error: unknown) {
      threw = true;
      throw error;
    }

    if (threw) {
      throw new Error("test: handler should return failure, not throw");
    }
  }

  protected async _validate(input: TaskListInput): Promise<void> {
    try {
      this.domainCase.validate(input);
    } catch (error: unknown) {
      throw new AppCaseError(
        "VALIDATION_FAILED",
        error instanceof Error ? error.message : "task_list validation failed"
      );
    }
  }

  protected _repository(): TaskStore {
    return this.resolveTaskStore();
  }

  protected async _service(): Promise<TaskListOutput> {
    const taskStore = this.resolveTaskStore();
    const tasks = await taskStore.read();

    try {
      assertTaskCollection(tasks, "task_list.persisted_tasks");
    } catch (error: unknown) {
      throw new AppCaseError(
        "INTERNAL",
        error instanceof Error ? error.message : "Persisted task data is invalid"
      );
    }

    const sortedTasks = [...tasks].sort(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt)
    );

    const output = { tasks: sortedTasks };
    this.domainCase.validateOutput(output);
    return output;
  }

  private resolveTaskStore(): TaskStore {
    const extra = this.ctx.extra as ApiExtraShape | undefined;
    const taskStore = extra?.providers?.taskStore;

    if (!taskStore) {
      throw new AppCaseError(
        "INTERNAL",
        "task_list requires a configured taskStore provider"
      );
    }

    return taskStore;
  }
}
