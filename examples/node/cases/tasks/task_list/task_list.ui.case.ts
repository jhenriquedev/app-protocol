import { BaseUiCase, type UIState, type UiContext } from "../../../core/ui.case";
import { type AppHttpClient } from "../../../core/shared/app_infra_contracts";
import {
  TaskListDomain,
  type Task,
  type TaskListInput,
  type TaskListOutput,
} from "./task_list.domain.case";

type ViewState = UIState & {
  tasks: Task[];
  loading: boolean;
  error: string | null;
};

interface UiPackages {
  designSystem?: {
    TaskBoard(props: { children?: string }): string;
    TaskColumn(props: {
      title: string;
      count: number;
      children?: string;
    }): string;
    TaskCard(props: {
      title: string;
      description?: string;
      status: Task["status"];
      actions?: string;
    }): string;
    EmptyColumnState(props: { message: string }): string;
  };
}

interface UiExtraShape {
  renderCardActions?: (task: Task) => string;
}

function createDesignSystemStub(): NonNullable<UiPackages["designSystem"]> {
  return {
    TaskBoard: ({ children }) => `<section>${children ?? ""}</section>`,
    TaskColumn: ({ title, children }) =>
      `<section><h3>${title}</h3>${children ?? ""}</section>`,
    TaskCard: ({ title }) => `<article>${title}</article>`,
    EmptyColumnState: ({ message }) => `<p>${message}</p>`,
  };
}

export class TaskListUi extends BaseUiCase<ViewState> {
  private readonly domainCase = new TaskListDomain();

  constructor(ctx: UiContext) {
    super(ctx, {
      tasks: [],
      loading: true,
      error: null,
    });
  }

  public view(): string {
    const packages = this.ctx.packages as UiPackages | undefined;
    const DesignSystem = packages?.designSystem;

    if (!DesignSystem) {
      throw new Error("task_list.ui requires packages.designSystem");
    }

    const extra = this.ctx.extra as UiExtraShape | undefined;
    const renderCardActions = extra?.renderCardActions;
    const viewModel = this._viewmodel(this.state);

    return `
      <section>
        ${viewModel.feedback ? `<div class="feedback feedback--error">${viewModel.feedback}</div>` : ""}
        ${DesignSystem.TaskBoard({
          children: viewModel.columns
            .map((column) =>
              DesignSystem.TaskColumn({
                title: column.title,
                count: column.tasks.length,
                children:
                  column.tasks.length > 0
                    ? column.tasks
                        .map((task) =>
                          DesignSystem.TaskCard({
                            title: task.title,
                            description: task.description,
                            status: task.status,
                            actions: renderCardActions?.(task),
                          })
                        )
                        .join("")
                    : DesignSystem.EmptyColumnState({
                        message: column.emptyMessage,
                      }),
              })
            )
            .join(""),
        })}
      </section>
    `;
  }

  public async load(input: TaskListInput = {}): Promise<TaskListOutput> {
    this.setState({
      tasks: this.state.tasks,
      loading: true,
      error: null,
    });

    try {
      const result = await this._service(input);
      this.setState({
        tasks: result.tasks,
        loading: false,
        error: null,
      });
      return result;
    } catch (error: unknown) {
      this.setState({
        tasks: [],
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load tasks",
      });
      return { tasks: [] };
    }
  }

  public async test(): Promise<void> {
    const ui = new TaskListUi({
      correlationId: "task-list-ui-test",
      logger: this.ctx.logger,
      api: {
        request: async () => ({
          tasks: [
            {
              id: "task_002",
              title: "Doing task",
              status: "doing",
              createdAt: "2026-03-18T12:30:00.000Z",
              updatedAt: "2026-03-18T12:30:00.000Z",
            },
            {
              id: "task_001",
              title: "Todo task",
              status: "todo",
              createdAt: "2026-03-18T12:00:00.000Z",
              updatedAt: "2026-03-18T12:00:00.000Z",
            },
          ],
        }),
      },
      packages: {
        designSystem: createDesignSystemStub(),
      },
    });

    await ui.load({});
    const view = ui.view();
    if (!view.includes("Todo task") || !view.includes("Doing task")) {
      throw new Error("test: view must return a visual unit");
    }

    const viewModel = ui._viewmodel({
      tasks: [
        {
          id: "task_001",
          title: "Todo task",
          status: "todo",
          createdAt: "2026-03-18T12:00:00.000Z",
          updatedAt: "2026-03-18T12:00:00.000Z",
        },
        {
          id: "task_002",
          title: "Doing task",
          status: "doing",
          createdAt: "2026-03-18T12:30:00.000Z",
          updatedAt: "2026-03-18T12:30:00.000Z",
        },
      ],
      loading: false,
      error: null,
    });

    const todoColumn = viewModel.columns.find((column) => column.status === "todo");
    const doingColumn = viewModel.columns.find((column) => column.status === "doing");

    if (todoColumn?.tasks.length !== 1 || doingColumn?.tasks.length !== 1) {
      throw new Error("test: ui viewmodel must group tasks by status");
    }
  }

  protected _viewmodel(state: ViewState): {
    columns: Array<{
      status: Task["status"];
      title: string;
      tasks: Task[];
      emptyMessage: string;
    }>;
    feedback: string | null;
  } {
    return {
      columns: [
        {
          status: "todo",
          title: "To Do",
          tasks: state.tasks.filter((task) => task.status === "todo"),
          emptyMessage: state.loading
            ? "Loading cards..."
            : "No cards in to do.",
        },
        {
          status: "doing",
          title: "Doing",
          tasks: state.tasks.filter((task) => task.status === "doing"),
          emptyMessage: state.loading
            ? "Loading cards..."
            : "No cards in doing.",
        },
        {
          status: "done",
          title: "Done",
          tasks: state.tasks.filter((task) => task.status === "done"),
          emptyMessage: state.loading
            ? "Loading cards..."
            : "No cards in done.",
        },
      ],
      feedback: state.error,
    };
  }

  protected async _service(input: TaskListInput): Promise<TaskListOutput> {
    this.domainCase.validate(input);
    return this._repository(input);
  }

  protected async _repository(
    _input: TaskListInput
  ): Promise<TaskListOutput> {
    const response = await this.resolveApiClient().request({
      method: "GET",
      url: "/tasks",
    });

    const result = response as TaskListOutput;
    this.domainCase.validateOutput(result);
    return result;
  }

  private resolveApiClient(): AppHttpClient {
    if (!this.ctx.api) {
      throw new Error("task_list.ui requires ctx.api");
    }

    return this.ctx.api;
  }
}
