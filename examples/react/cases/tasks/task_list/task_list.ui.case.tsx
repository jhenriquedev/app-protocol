import type { ReactElement } from "react";
import { useEffect, useState } from "react";

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
    TaskBoard(props: { children?: ReactElement | ReactElement[] }): ReactElement;
    TaskColumn(props: {
      title: string;
      count: number;
      children?: ReactElement | ReactElement[];
    }): ReactElement;
    TaskCard(props: {
      title: string;
      description?: string;
      status: Task["status"];
      actions?: ReactElement;
    }): ReactElement;
    EmptyColumnState(props: { message: string }): ReactElement;
  };
}

interface UiExtraShape {
  refreshToken?: number;
  renderCardActions?: (task: Task) => ReactElement | null;
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

  public view(): ReactElement {
    const packages = this.ctx.packages as UiPackages | undefined;
    const DesignSystem = packages?.designSystem;

    if (!DesignSystem) {
      throw new Error("task_list.ui requires packages.designSystem");
    }

    const resolvedDesignSystem = DesignSystem;
    const self = this;
    const extra = this.ctx.extra as UiExtraShape | undefined;
    const refreshToken = extra?.refreshToken ?? 0;
    const renderCardActions = extra?.renderCardActions;

    function TaskListView(): ReactElement {
      const [state, setState] = useState<ViewState>({
        tasks: [],
        loading: true,
        error: null,
      });

      useEffect(() => {
        let cancelled = false;

        async function loadTasks(): Promise<void> {
          setState((current) => ({
            ...current,
            loading: true,
            error: null,
          }));

          try {
            const result = await self._service({});
            if (cancelled) {
              return;
            }

            setState({
              tasks: result.tasks,
              loading: false,
              error: null,
            });
          } catch (error: unknown) {
            if (cancelled) {
              return;
            }

            setState({
              tasks: [],
              loading: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to load tasks",
            });
          }
        }

        void loadTasks();

        return () => {
          cancelled = true;
        };
      }, [refreshToken]);

      const viewModel = self._viewmodel(state);

      return (
        <section>
          {viewModel.feedback ? (
            <div
              style={{
                background: "#ffe1dd",
                borderRadius: "14px",
                color: "#9a2d1f",
                marginBottom: "1rem",
                padding: "0.9rem 1rem",
              }}
            >
              {viewModel.feedback}
            </div>
          ) : null}

          <resolvedDesignSystem.TaskBoard>
            {viewModel.columns.map((column) => (
              <resolvedDesignSystem.TaskColumn
                key={column.status}
                title={column.title}
                count={column.tasks.length}
              >
                {column.tasks.length > 0 ? (
                  column.tasks.map((task) => (
                    <resolvedDesignSystem.TaskCard
                      key={task.id}
                      title={task.title}
                      description={task.description}
                      status={task.status}
                      actions={renderCardActions?.(task) ?? undefined}
                    />
                  ))
                ) : (
                  <resolvedDesignSystem.EmptyColumnState
                    message={column.emptyMessage}
                  />
                )}
              </resolvedDesignSystem.TaskColumn>
            ))}
          </resolvedDesignSystem.TaskBoard>
        </section>
      );
    }

    return <TaskListView />;
  }

  public async test(): Promise<void> {
    const view = this.view();
    if (!view) {
      throw new Error("test: view must return a visual unit");
    }

    const result = await this._service({});
    if (result.tasks.length !== 2) {
      throw new Error("test: ui service must return the mocked task list");
    }

    const viewModel = this._viewmodel({
      tasks: result.tasks,
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
            ? "Carregando cards..."
            : "Nenhum card em to do.",
        },
        {
          status: "doing",
          title: "Doing",
          tasks: state.tasks.filter((task) => task.status === "doing"),
          emptyMessage: state.loading
            ? "Carregando cards..."
            : "Nenhum card em doing.",
        },
        {
          status: "done",
          title: "Done",
          tasks: state.tasks.filter((task) => task.status === "done"),
          emptyMessage: state.loading
            ? "Carregando cards..."
            : "Nenhum card em done.",
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
