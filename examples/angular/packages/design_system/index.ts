import { CommonModule, NgComponentOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Type,
  ViewEncapsulation,
} from "@angular/core";

export type TaskStatus = "todo" | "doing" | "done";

export interface AngularViewUnit {
  component: Type<unknown>;
  inputs?: Record<string, unknown>;
}

export interface TaskBoardCard {
  title: string;
  description?: string;
  status: TaskStatus;
  actions?: AngularViewUnit | null;
}

export interface TaskBoardColumn {
  status: TaskStatus;
  title: string;
  tasks: TaskBoardCard[];
  emptyMessage: string;
}

const GLOBAL_STYLES = `
  .app-shell {
    background: linear-gradient(180deg, #f5f7fb 0%, #edf1f7 48%, #fdfefe 100%);
    color: #1f2430;
    font-family: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
    min-height: 100vh;
    padding: 2.5rem 1.5rem 3rem;
  }

  .app-shell__container {
    margin: 0 auto;
    max-width: 1120px;
  }

  .app-shell__header {
    align-items: flex-start;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    margin-bottom: 2rem;
  }

  .app-shell__eyebrow {
    color: #637083;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    margin-bottom: 0.55rem;
    text-transform: uppercase;
  }

  .app-shell__title {
    font-size: 2.5rem;
    line-height: 1.05;
    margin: 0;
  }

  .app-shell__subtitle {
    color: #5f646d;
    font-size: 1rem;
    margin: 0.7rem 0 0;
    max-width: 52rem;
  }

  .ds-surface {
    background: #ffffff;
    border: 1px solid #d8dde6;
    border-radius: 20px;
    box-shadow: 0 20px 45px rgba(18, 26, 41, 0.08);
  }

  .board-header {
    margin-bottom: 1.5rem;
    padding: 1.15rem 1.25rem;
  }

  .board-header__title {
    font-size: 1.1rem;
    margin: 0;
  }

  .board-header__subtitle {
    color: #5f646d;
    margin: 0.45rem 0 0;
  }

  .ds-button {
    border: none;
    border-radius: 999px;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 600;
    padding: 0.8rem 1.1rem;
  }

  .create-task-button {
    background: #1f2430;
    color: #ffffff;
    justify-content: center;
  }

  .create-task-button:disabled {
    background: #cfd5df;
    cursor: default;
    opacity: 0.72;
  }

  .task-board {
    align-items: start;
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .task-column {
    min-height: 320px;
    padding: 1rem;
  }

  .task-column__header {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.9rem;
  }

  .task-column__title {
    font-size: 1rem;
    margin: 0;
  }

  .task-column__count {
    background: #edf1f7;
    border-radius: 999px;
    color: #425166;
    font-size: 0.8rem;
    font-weight: 700;
    min-width: 2rem;
    padding: 0.2rem 0.55rem;
    text-align: center;
  }

  .task-column__cards {
    display: grid;
    gap: 0.85rem;
  }

  .task-card {
    background: #fdfefe;
    border: 1px solid #e5eaf1;
    border-radius: 16px;
    padding: 0.95rem;
  }

  .task-card__header {
    align-items: flex-start;
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    margin-bottom: 0.65rem;
  }

  .task-card__title {
    font-size: 1rem;
    margin: 0;
    overflow-wrap: anywhere;
  }

  .task-card__description {
    color: #5f646d;
    font-size: 0.94rem;
    margin: 0;
  }

  .task-card__actions {
    margin-top: 0.85rem;
  }

  .task-status-badge {
    border-radius: 999px;
    display: inline-flex;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.35rem 0.65rem;
    text-transform: uppercase;
  }

  .task-status-badge--todo {
    background: #fff4cc;
    color: #7a5d00;
  }

  .task-status-badge--doing {
    background: #d9efff;
    color: #005a91;
  }

  .task-status-badge--done {
    background: #dff7e4;
    color: #0c6a36;
  }

  .move-task-action {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .move-task-action__button {
    background: #edf1f7;
    color: #2f3745;
    font-size: 0.8rem;
    padding: 0.45rem 0.7rem;
  }

  .move-task-action__button:disabled {
    background: #d6dce5;
    cursor: default;
    opacity: 0.72;
  }

  .task-form-modal {
    align-items: center;
    background: rgba(18, 26, 41, 0.46);
    display: flex;
    inset: 0;
    justify-content: center;
    padding: 1rem;
    position: fixed;
    z-index: 10;
  }

  .task-form-modal__panel {
    max-height: calc(100vh - 2rem);
    overflow: auto;
    padding: 1.25rem;
    width: min(100%, 480px);
  }

  .task-form-modal__title {
    margin-top: 0;
  }

  .task-form-modal__field {
    display: grid;
    gap: 0.35rem;
  }

  .task-form-modal__field--spaced {
    margin-bottom: 0.85rem;
  }

  .task-form-modal__field--last {
    margin-bottom: 1rem;
  }

  .task-form-modal__field-input {
    border: 1px solid #cad2de;
    border-radius: 12px;
    box-sizing: border-box;
    font: inherit;
    padding: 0.8rem 0.9rem;
    width: 100%;
  }

  .task-form-modal__field-textarea {
    resize: vertical;
  }

  .task-form-modal__actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .task-form-modal__secondary {
    background: #edf1f7;
    color: #2f3745;
  }

  .task-form-modal__primary {
    background: #1f2430;
    color: #ffffff;
  }

  .empty-column-state {
    border: 1px dashed #d1d8e2;
    border-radius: 14px;
    color: #637083;
    font-size: 0.93rem;
    padding: 1rem;
  }

  @media (max-width: 1024px) {
    .task-board {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    .app-shell {
      padding: 1.25rem 0.9rem 1.75rem;
    }

    .app-shell__header {
      align-items: stretch;
      flex-direction: column;
      margin-bottom: 1.4rem;
    }

    .app-shell__title {
      font-size: 1.95rem;
    }

    .task-board {
      grid-template-columns: minmax(0, 1fr);
    }

    .task-column {
      min-height: auto;
    }

    .task-card__header {
      flex-direction: column;
    }

    .task-form-modal {
      align-items: flex-end;
      padding: 0.75rem;
    }

    .task-form-modal__panel {
      border-radius: 18px;
      max-height: calc(100vh - 1.5rem);
      width: 100%;
    }

    .task-form-modal__actions {
      flex-direction: column-reverse;
    }

    .task-form-modal__actions button,
    .create-task-button {
      width: 100%;
    }

    .move-task-action__button {
      flex: 1 1 calc(50% - 0.45rem);
    }
  }

  @media (max-width: 480px) {
    .app-shell__title {
      font-size: 1.7rem;
    }

    .task-card {
      padding: 0.85rem;
    }

    .move-task-action__button {
      flex-basis: 100%;
    }
  }
`;

function coerceBoolean(value: boolean | "" | null | undefined): boolean {
  return value === "" || value === true;
}

@Component({
  selector: "app-ds-shell",
  standalone: true,
  imports: [CommonModule],
  styles: [GLOBAL_STYLES],
  template: `
    <div class="app-shell">
      <div class="app-shell__container">
        <header class="app-shell__header">
          <div>
            <div class="app-shell__eyebrow">APP Angular Example</div>
            <h1 class="app-shell__title">{{ title }}</h1>
            <p class="app-shell__subtitle" *ngIf="subtitle">{{ subtitle }}</p>
          </div>
        </header>

        <ng-content />
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
}

@Component({
  selector: "app-ds-board-header",
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="board-header ds-surface">
      <h2 class="board-header__title">{{ title }}</h2>
      <p class="board-header__subtitle" *ngIf="subtitle">{{ subtitle }}</p>
    </section>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
}

@Component({
  selector: "app-ds-create-task-button",
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      class="ds-button create-task-button"
      type="button"
      [disabled]="disabled"
      (click)="handleClick()"
    >
      New Task
    </button>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateTaskButtonComponent {
  @Input() disabled = false;
  @Input() onClick?: () => void;

  protected handleClick(): void {
    if (this.disabled) {
      return;
    }

    this.onClick?.();
  }
}

@Component({
  selector: "app-ds-dynamic-view",
  standalone: true,
  imports: [CommonModule, NgComponentOutlet],
  template: `
    <ng-container
      *ngIf="view"
      [ngComponentOutlet]="view.component"
      [ngComponentOutletInputs]="view.inputs ?? {}"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicViewOutletComponent {
  @Input() view: AngularViewUnit | null = null;
}

@Component({
  selector: "app-ds-task-status-badge",
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="task-status-badge" [ngClass]="badgeClass">
      {{ status }}
    </span>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskStatusBadgeComponent {
  @Input({ required: true }) status!: TaskStatus;

  protected get badgeClass(): string {
    return `task-status-badge--${this.status}`;
  }
}

@Component({
  selector: "app-ds-task-card",
  standalone: true,
  imports: [CommonModule, TaskStatusBadgeComponent, DynamicViewOutletComponent],
  template: `
    <article class="task-card">
      <div class="task-card__header">
        <h4 class="task-card__title">{{ title }}</h4>
        <app-ds-task-status-badge [status]="status" />
      </div>

      <p class="task-card__description" *ngIf="description">{{ description }}</p>

      <div class="task-card__actions" *ngIf="actions">
        <app-ds-dynamic-view [view]="actions" />
      </div>
    </article>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskCardComponent {
  @Input({ required: true }) title!: string;
  @Input() description?: string;
  @Input({ required: true }) status!: TaskStatus;
  @Input() actions: AngularViewUnit | null = null;
}

@Component({
  selector: "app-ds-empty-column-state",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-column-state">
      {{ message }}
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyColumnStateComponent {
  @Input({ required: true }) message!: string;
}

@Component({
  selector: "app-ds-task-column",
  standalone: true,
  imports: [CommonModule, TaskCardComponent, EmptyColumnStateComponent],
  template: `
    <section class="task-column ds-surface">
      <div class="task-column__header">
        <h3 class="task-column__title">{{ title }}</h3>
        <span class="task-column__count">{{ count }}</span>
      </div>

      <div class="task-column__cards" *ngIf="tasks.length > 0; else emptyState">
        <app-ds-task-card
          *ngFor="let task of tasks"
          [title]="task.title"
          [description]="task.description"
          [status]="task.status"
          [actions]="task.actions ?? null"
        />
      </div>

      <ng-template #emptyState>
        <app-ds-empty-column-state [message]="emptyMessage" />
      </ng-template>
    </section>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskColumnComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) count!: number;
  @Input() tasks: TaskBoardCard[] = [];
  @Input({ required: true }) emptyMessage!: string;
}

@Component({
  selector: "app-ds-task-board",
  standalone: true,
  imports: [CommonModule, TaskColumnComponent],
  template: `
    <section class="task-board">
      <app-ds-task-column
        *ngFor="let column of columns"
        [title]="column.title"
        [count]="column.tasks.length"
        [tasks]="column.tasks"
        [emptyMessage]="column.emptyMessage"
      />
    </section>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskBoardComponent {
  @Input() columns: TaskBoardColumn[] = [];
}

export const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "done"];

@Component({
  selector: "app-ds-move-task-action",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="move-task-action">
      <button
        *ngFor="let status of statuses"
        class="ds-button move-task-action__button"
        type="button"
        [disabled]="submitting || status === currentStatus"
        (click)="move(status)"
      >
        Move to {{ status }}
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveTaskActionComponent {
  @Input({ required: true }) currentStatus!: TaskStatus;
  @Input() submitting = false;
  @Input() onMove?: (nextStatus: TaskStatus) => void;

  protected readonly statuses = TASK_STATUSES;

  protected move(status: TaskStatus): void {
    if (this.submitting || status === this.currentStatus) {
      return;
    }

    this.onMove?.(status);
  }
}

@Component({
  selector: "app-ds-task-form-modal",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="task-form-modal" *ngIf="open">
      <form class="task-form-modal__panel ds-surface" (submit)="handleSubmit($event)">
        <h3 class="task-form-modal__title">Create task</h3>

        <label class="task-form-modal__field task-form-modal__field--spaced">
          <span>Title</span>
          <input
            class="task-form-modal__field-input"
            [disabled]="submitting"
            [value]="titleValue"
            (input)="handleTitleChange($event)"
          />
        </label>

        <label class="task-form-modal__field task-form-modal__field--last">
          <span>Description</span>
          <textarea
            class="task-form-modal__field-input task-form-modal__field-textarea"
            [disabled]="submitting"
            [value]="descriptionValue"
            rows="4"
            (input)="handleDescriptionChange($event)"
          ></textarea>
        </label>

        <div class="task-form-modal__actions">
          <button
            class="ds-button task-form-modal__secondary"
            type="button"
            [disabled]="submitting"
            (click)="onClose?.()"
          >
            Cancel
          </button>
          <button
            class="ds-button task-form-modal__primary"
            type="submit"
            [disabled]="submitting"
          >
            {{ submitting ? "Saving..." : "Save task" }}
          </button>
        </div>
      </form>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskFormModalComponent {
  @Input() open = false;
  @Input() titleValue = "";
  @Input() descriptionValue = "";
  @Input() submitting = false;
  @Input() onTitleChange?: (value: string) => void;
  @Input() onDescriptionChange?: (value: string) => void;
  @Input() onClose?: () => void;
  @Input() onSubmit?: () => void;

  protected handleSubmit(event: Event): void {
    event.preventDefault();

    if (!this.submitting) {
      this.onSubmit?.();
    }
  }

  protected handleTitleChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.onTitleChange?.(target?.value ?? "");
  }

  protected handleDescriptionChange(event: Event): void {
    const target = event.target as HTMLTextAreaElement | null;
    this.onDescriptionChange?.(target?.value ?? "");
  }
}

export const DesignSystem = {
  AppShell: AppShellComponent,
  BoardHeader: BoardHeaderComponent,
  CreateTaskButton: CreateTaskButtonComponent,
  TaskBoard: TaskBoardComponent,
  TaskColumn: TaskColumnComponent,
  TaskCard: TaskCardComponent,
  TaskStatusBadge: TaskStatusBadgeComponent,
  MoveTaskAction: MoveTaskActionComponent,
  TaskFormModal: TaskFormModalComponent,
  EmptyColumnState: EmptyColumnStateComponent,
  TASK_STATUSES,
} as const;
