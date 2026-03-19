import { CommonModule, NgComponentOutlet } from "@angular/common";
import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  Type,
  signal,
} from "@angular/core";

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

interface AngularViewUnit {
  component: Type<unknown>;
  inputs?: Record<string, unknown>;
}

interface TaskBoardColumnView {
  status: Task["status"];
  title: string;
  tasks: Array<{
    title: string;
    description?: string;
    status: Task["status"];
    actions?: AngularViewUnit | null;
  }>;
  emptyMessage: string;
}

interface TaskListDesignSystem {
  TaskBoard: Type<unknown>;
}

interface UiExtraShape {
  refreshToken?: number;
  renderCardActions?: (task: Task) => AngularViewUnit | null;
}

@Component({
  selector: "app-task-list-view",
  standalone: true,
  imports: [CommonModule, NgComponentOutlet],
  template: `
    <section>
      <div
        *ngIf="feedback"
        style="background: #ffe1dd; border-radius: 14px; color: #9a2d1f; margin-bottom: 1rem; padding: 0.9rem 1rem;"
      >
        {{ feedback }}
      </div>

      <ng-container
        [ngComponentOutlet]="designSystem.TaskBoard"
        [ngComponentOutletInputs]="taskBoardInputs"
      />
    </section>
  `,
})
class TaskListViewComponent implements OnInit, OnChanges {
  @Input({ required: true }) caseRef!: TaskListUi;
  @Input({ required: true }) designSystem!: TaskListDesignSystem;
  @Input() refreshToken = 0;
  @Input() renderCardActions?: (task: Task) => AngularViewUnit | null;

  protected readonly state = signal<ViewState>({
    tasks: [],
    loading: true,
    error: null,
  });

  public ngOnInit(): void {
    void this.loadTasks();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes["refreshToken"] && !changes["refreshToken"].firstChange) {
      void this.loadTasks();
    }
  }

  protected get feedback(): string | null {
    return this.caseRef.present(this.state()).feedback;
  }

  protected get taskBoardInputs(): Record<string, unknown> {
    const viewModel = this.caseRef.present(this.state());

    return {
      columns: viewModel.columns.map((column): TaskBoardColumnView => ({
        status: column.status,
        title: column.title,
        emptyMessage: column.emptyMessage,
        tasks: column.tasks.map((task) => ({
          title: task.title,
          description: task.description,
          status: task.status,
          actions: this.renderCardActions?.(task) ?? null,
        })),
      })),
    };
  }

  private async loadTasks(): Promise<void> {
    this.state.update((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    try {
      const result = await this.caseRef.loadTasks({});
      this.state.set({
        tasks: result.tasks,
        loading: false,
        error: null,
      });
    } catch (error: unknown) {
      this.state.set({
        tasks: [],
        loading: false,
        error:
          error instanceof Error ? error.message : "Failed to load tasks",
      });
    }
  }
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

  public view(): AngularViewUnit {
    const packages = this.ctx.packages as { designSystem?: TaskListDesignSystem } | undefined;
    const DesignSystem = packages?.designSystem;
    const extra = this.ctx.extra as UiExtraShape | undefined;

    if (!DesignSystem) {
      throw new Error("task_list.ui requires packages.designSystem");
    }

    return {
      component: TaskListViewComponent,
      inputs: {
        caseRef: this,
        designSystem: DesignSystem,
        refreshToken: extra?.refreshToken ?? 0,
        renderCardActions: extra?.renderCardActions,
      },
    };
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

  public present(state: ViewState): {
    columns: Array<{
      status: Task["status"];
      title: string;
      tasks: Task[];
      emptyMessage: string;
    }>;
    feedback: string | null;
  } {
    return this._viewmodel(state);
  }

  public async loadTasks(input: TaskListInput): Promise<TaskListOutput> {
    return this._service(input);
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
