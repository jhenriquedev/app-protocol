import {
  type ApiContext,
  type ApiResponse,
  BaseApiCase,
} from "../../../core/api.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";
import {
  TaskCreateDomain,
  type Task,
  type TaskCreateInput,
  type TaskCreateOutput,
} from "./task_create.domain.case";

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

export class TaskCreateApi extends BaseApiCase<
  TaskCreateInput,
  TaskCreateOutput
> {
  private readonly domainCase = new TaskCreateDomain();

  public async handler(
    input: TaskCreateInput
  ): Promise<ApiResponse<TaskCreateOutput>> {
    const result = await this.execute(input);

    if (result.success) {
      return {
        ...result,
        statusCode: 201,
      };
    }

    return {
      ...result,
      statusCode: mapErrorCodeToStatus(result.error?.code),
    };
  }

  public router(): unknown {
    return {
      method: "POST",
      path: "/tasks",
      handler: (request: { body: TaskCreateInput }) => this.handler(request.body),
    };
  }

  public async test(): Promise<void> {
    const store = this.resolveTaskStore();
    await store.reset?.();

    const result = await this.handler({
      title: "Test task",
      description: "Created by task_create.api test",
    });

    if (!result.success || !result.data) {
      throw new Error("test: handler should return success");
    }

    if (result.statusCode !== 201) {
      throw new Error("test: successful create must return statusCode 201");
    }

    if (result.data.task.status !== "todo") {
      throw new Error("test: created task must start in todo");
    }

    const persisted = await store.read();
    if (persisted.length !== 1) {
      throw new Error("test: created task must be persisted");
    }

    await store.reset?.();

    const concurrentCreates = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        this.handler({
          title: `Concurrent task ${index + 1}`,
        })
      )
    );

    if (concurrentCreates.some((item) => !item.success)) {
      throw new Error("test: concurrent creates must all succeed");
    }

    const concurrentPersisted = await store.read();
    if (concurrentPersisted.length !== 4) {
      throw new Error("test: concurrent creates must persist every task");
    }

    let threw = false;
    try {
      await this._validate({ title: "   " });
    } catch {
      threw = true;
    }

    if (!threw) {
      throw new Error("test: _validate must reject blank title");
    }
  }

  protected async _validate(input: TaskCreateInput): Promise<void> {
    try {
      this.domainCase.validate(input);
    } catch (error: unknown) {
      throw new AppCaseError(
        "VALIDATION_FAILED",
        error instanceof Error ? error.message : "task_create validation failed"
      );
    }
  }

  protected _repository(): TaskStore {
    return this.resolveTaskStore();
  }

  protected async _service(input: TaskCreateInput): Promise<TaskCreateOutput> {
    const taskStore = this.resolveTaskStore();

    const timestamp = new Date().toISOString();
    const task: Task = {
      id: globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      status: "todo",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await taskStore.update((tasks) => [task, ...tasks]);

    this.ctx.logger.info("task_create: task persisted", {
      taskId: task.id,
      title: task.title,
    });

    return { task };
  }

  private resolveTaskStore(): TaskStore {
    const extra = this.ctx.extra as ApiExtraShape | undefined;
    const taskStore = extra?.providers?.taskStore;

    if (!taskStore) {
      throw new AppCaseError(
        "INTERNAL",
        "task_create requires a configured taskStore provider"
      );
    }

    return taskStore;
  }
}
