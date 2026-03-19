import type { ReactElement } from "react";
import { useState } from "react";

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

interface UiPackages {
  designSystem?: {
    CreateTaskButton(props: {
      disabled?: boolean;
      onClick?: () => void;
    }): ReactElement;
    TaskFormModal(props: {
      open: boolean;
      titleValue: string;
      descriptionValue: string;
      submitting?: boolean;
      onTitleChange?: (value: string) => void;
      onDescriptionChange?: (value: string) => void;
      onClose?: () => void;
      onSubmit?: () => void;
    }): ReactElement | null;
  };
}

interface UiExtraShape {
  onTaskCreated?: (task: Task) => void;
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

  public view(): ReactElement {
    const packages = this.ctx.packages as UiPackages | undefined;
    const DesignSystem = packages?.designSystem;

    if (!DesignSystem) {
      throw new Error("task_create.ui requires packages.designSystem");
    }

    const resolvedDesignSystem = DesignSystem;
    const self = this;

    function TaskCreateView(): ReactElement {
      const [state, setState] = useState<ViewState>({
        modalOpen: false,
        title: "",
        description: "",
        loading: false,
        error: null,
        result: null,
      });

      const viewModel = self._viewmodel(state);

      async function submit(): Promise<void> {
        if (!self._acquireSubmissionLock()) {
          return;
        }

        setState((current) => ({
          ...current,
          loading: true,
          error: null,
        }));

        try {
          const result = await self._service({
            title: state.title,
            description: state.description || undefined,
          });

          const extra = self.ctx.extra as UiExtraShape | undefined;
          extra?.onTaskCreated?.(result.task);

          setState({
            modalOpen: false,
            title: "",
            description: "",
            loading: false,
            error: null,
            result,
          });
        } catch (error: unknown) {
          setState((current) => ({
            ...current,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to create task",
          }));
        } finally {
          self._releaseSubmissionLock();
        }
      }

      return (
        <section style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <resolvedDesignSystem.CreateTaskButton
              disabled={state.loading}
              onClick={() =>
                setState((current) => ({
                  ...current,
                  modalOpen: true,
                  error: null,
                }))
              }
            />
          </div>

          <resolvedDesignSystem.TaskFormModal
            open={state.modalOpen}
            titleValue={state.title}
            descriptionValue={state.description}
            submitting={state.loading}
            onTitleChange={(value) =>
              setState((current) => ({
                ...current,
                title: value,
              }))
            }
            onDescriptionChange={(value) =>
              setState((current) => ({
                ...current,
                description: value,
              }))
            }
            onClose={() =>
              setState((current) => ({
                ...current,
                modalOpen: false,
                error: null,
              }))
            }
            onSubmit={() => {
              void submit();
            }}
          />

          {viewModel.feedback ? (
            <div
              style={{
                background:
                  viewModel.feedback.type === "success"
                    ? "#dff7e4"
                    : "#ffe1dd",
                borderRadius: "14px",
                color:
                  viewModel.feedback.type === "success"
                    ? "#0c6a36"
                    : "#9a2d1f",
                marginTop: "1rem",
                padding: "0.9rem 1rem",
              }}
            >
              {viewModel.feedback.message}
            </div>
          ) : null}
        </section>
      );
    }

    return <TaskCreateView />;
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
    if (!result?.task?.id) {
      throw new Error("task_create.ui received an invalid create response");
    }

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
