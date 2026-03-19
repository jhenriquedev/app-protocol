import { CommonModule, NgComponentOutlet } from "@angular/common";
import { Component, Input, Type, signal } from "@angular/core";

import { BaseUiCase, type UIState, type UiContext } from "../../../core/ui.case";
import { type AppHttpClient } from "../../../core/shared/app_infra_contracts";
import {
  TaskCreateDomain,
  type Task,
  type TaskCreateInput,
  type TaskCreateOutput,
} from "./task_create.domain.case";

type ViewState = UIState & {
  modalOpen: boolean;
  title: string;
  description: string;
  loading: boolean;
  error: string | null;
  result: TaskCreateOutput | null;
};

interface AngularViewUnit {
  component: Type<unknown>;
  inputs?: Record<string, unknown>;
}

interface TaskCreateDesignSystem {
  CreateTaskButton: Type<unknown>;
  TaskFormModal: Type<unknown>;
}

interface UiExtraShape {
  onTaskCreated?: (task: Task) => void;
}

@Component({
  selector: "app-task-create-view",
  standalone: true,
  imports: [CommonModule, NgComponentOutlet],
  template: `
    <section style="margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: flex-end;">
        <ng-container
          [ngComponentOutlet]="designSystem.CreateTaskButton"
          [ngComponentOutletInputs]="createButtonInputs"
        />
      </div>

      <ng-container
        [ngComponentOutlet]="designSystem.TaskFormModal"
        [ngComponentOutletInputs]="taskFormModalInputs"
      />

      <div
        *ngIf="feedback as currentFeedback"
        [style.background]="currentFeedback.type === 'success' ? '#dff7e4' : '#ffe1dd'"
        style="border-radius: 14px; margin-top: 1rem; padding: 0.9rem 1rem;"
        [style.color]="currentFeedback.type === 'success' ? '#0c6a36' : '#9a2d1f'"
      >
        {{ currentFeedback.message }}
      </div>
    </section>
  `,
})
class TaskCreateViewComponent {
  @Input({ required: true }) caseRef!: TaskCreateUi;
  @Input({ required: true }) designSystem!: TaskCreateDesignSystem;

  protected readonly state = signal<ViewState>({
    modalOpen: false,
    title: "",
    description: "",
    loading: false,
    error: null,
    result: null,
  });

  protected get createButtonInputs(): Record<string, unknown> {
    const state = this.state();

    return {
      disabled: state.loading,
      onClick: () => {
        this.state.update((current) => ({
          ...current,
          modalOpen: true,
          error: null,
        }));
      },
    };
  }

  protected get taskFormModalInputs(): Record<string, unknown> {
    const state = this.state();

    return {
      open: state.modalOpen,
      titleValue: state.title,
      descriptionValue: state.description,
      submitting: state.loading,
      onTitleChange: (value: string) => {
        this.state.update((current) => ({
          ...current,
          title: value,
        }));
      },
      onDescriptionChange: (value: string) => {
        this.state.update((current) => ({
          ...current,
          description: value,
        }));
      },
      onClose: () => {
        this.state.update((current) => ({
          ...current,
          modalOpen: false,
          error: null,
        }));
      },
      onSubmit: () => {
        void this.submit();
      },
    };
  }

  protected get feedback():
    | {
        type: "success" | "error";
        message: string;
      }
    | null {
    return this.caseRef.present(this.state()).feedback;
  }

  private async submit(): Promise<void> {
    if (!this.caseRef.acquireSubmissionLock()) {
      return;
    }

    this.state.update((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    try {
      const current = this.state();
      const result = await this.caseRef.runService({
        title: current.title,
        description: current.description || undefined,
      });

      this.caseRef.onTaskCreated(result.task);

      this.state.set({
        modalOpen: false,
        title: "",
        description: "",
        loading: false,
        error: null,
        result,
      });
    } catch (error: unknown) {
      this.state.update((current) => ({
        ...current,
        loading: false,
        error:
          error instanceof Error ? error.message : "Failed to create task",
      }));
    } finally {
      this.caseRef.releaseSubmissionLock();
    }
  }
}

export class TaskCreateUi extends BaseUiCase<ViewState> {
  private readonly domainCase = new TaskCreateDomain();
  private submissionLocked = false;

  constructor(ctx: UiContext) {
    super(ctx, {
      modalOpen: false,
      title: "",
      description: "",
      loading: false,
      error: null,
      result: null,
    });
  }

  public view(): AngularViewUnit {
    const packages = this.ctx.packages as { designSystem?: TaskCreateDesignSystem } | undefined;
    const DesignSystem = packages?.designSystem;

    if (!DesignSystem) {
      throw new Error("task_create.ui requires packages.designSystem");
    }

    return {
      component: TaskCreateViewComponent,
      inputs: {
        caseRef: this,
        designSystem: DesignSystem,
      },
    };
  }

  public async test(): Promise<void> {
    const view = this.view();
    if (!view) {
      throw new Error("test: view must return a visual unit");
    }

    const result = await this._service({
      title: "Create task UI test",
      description: "UI surface repository flow",
    });

    if (!result.task.id) {
      throw new Error("test: ui service must return a created task id");
    }

    const viewModel = this._viewmodel({
      modalOpen: false,
      title: "",
      description: "",
      loading: false,
      error: null,
      result,
    });

    if (viewModel.feedback?.type !== "success") {
      throw new Error("test: ui viewmodel must expose success feedback");
    }

    let threw = false;
    try {
      await this._service({ title: "   " });
    } catch {
      threw = true;
    }

    if (!threw) {
      throw new Error("test: ui service must reject blank title");
    }

    if (!this._acquireSubmissionLock()) {
      throw new Error("test: first submission lock acquisition must succeed");
    }

    if (this._acquireSubmissionLock()) {
      throw new Error("test: submission lock must reject reentry");
    }

    this._releaseSubmissionLock();

    if (!this._acquireSubmissionLock()) {
      throw new Error("test: submission lock must be releasable");
    }

    this._releaseSubmissionLock();
  }

  public present(state: ViewState): {
    feedback:
      | {
          type: "success" | "error";
          message: string;
        }
      | null;
  } {
    return this._viewmodel(state);
  }

  public async runService(input: TaskCreateInput): Promise<TaskCreateOutput> {
    return this._service(input);
  }

  public onTaskCreated(task: Task): void {
    const extra = this.ctx.extra as UiExtraShape | undefined;
    extra?.onTaskCreated?.(task);
  }

  public acquireSubmissionLock(): boolean {
    return this._acquireSubmissionLock();
  }

  public releaseSubmissionLock(): void {
    this._releaseSubmissionLock();
  }

  protected _viewmodel(state: ViewState): {
    feedback:
      | {
          type: "success" | "error";
          message: string;
        }
      | null;
  } {
    if (state.error) {
      return {
        feedback: {
          type: "error",
          message: state.error,
        },
      };
    }

    if (state.result) {
      return {
        feedback: {
          type: "success",
          message: `Task "${state.result.task.title}" created successfully.`,
        },
      };
    }

    return {
      feedback: null,
    };
  }

  protected async _service(
    input: TaskCreateInput
  ): Promise<TaskCreateOutput> {
    this.domainCase.validate(input);
    return this._repository(input);
  }

  protected async _repository(
    input: TaskCreateInput
  ): Promise<TaskCreateOutput> {
    const response = await this.resolveApiClient().request({
      method: "POST",
      url: "/tasks",
      body: input,
    });

    const result = response as TaskCreateOutput;
    this.domainCase.validateOutput(result);
    return result;
  }

  protected _acquireSubmissionLock(): boolean {
    if (this.submissionLocked) {
      return false;
    }

    this.submissionLocked = true;
    return true;
  }

  protected _releaseSubmissionLock(): void {
    this.submissionLocked = false;
  }

  private resolveApiClient(): AppHttpClient {
    if (!this.ctx.api) {
      throw new Error("task_create.ui requires ctx.api");
    }

    return this.ctx.api;
  }
}
