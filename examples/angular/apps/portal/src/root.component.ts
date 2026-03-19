import { CommonModule, NgComponentOutlet } from "@angular/common";
import { Component, Type, signal } from "@angular/core";

import {
  AppShellComponent,
  BoardHeaderComponent,
} from "../../../packages/design_system/index";
import { createUiContext, registry } from "../app";

interface AngularViewUnit {
  component: Type<unknown>;
  inputs?: Record<string, unknown>;
}

interface PortalTask {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "doing" | "done";
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: "app-portal-root",
  standalone: true,
  imports: [
    CommonModule,
    NgComponentOutlet,
    AppShellComponent,
    BoardHeaderComponent,
  ],
  template: `
    <app-ds-shell
      title="Task Board"
      subtitle="Angular + Node APP example with create, list, and move wired through Cases."
    >
      <app-ds-board-header
        title="Board"
        subtitle="Tasks load from the backend and each card can now move across columns."
      />

      <ng-container
        [ngComponentOutlet]="taskCreateView().component"
        [ngComponentOutletInputs]="taskCreateView().inputs ?? {}"
      ></ng-container>

      <ng-container
        [ngComponentOutlet]="taskListView().component"
        [ngComponentOutletInputs]="taskListView().inputs ?? {}"
      ></ng-container>
    </app-ds-shell>
  `,
})
export class PortalRootComponent {
  private refreshToken = 0;
  protected readonly taskCreateView = signal<AngularViewUnit>(
    this.buildTaskCreateView()
  );
  protected readonly taskListView = signal<AngularViewUnit>(
    this.buildTaskListView()
  );

  private buildTaskCreateView(): AngularViewUnit {
    const TaskCreateUi = registry._cases.tasks.task_create.ui;

    if (!TaskCreateUi) {
      throw new Error("Portal registry must expose tasks/task_create.ui");
    }

    return new TaskCreateUi(
      createUiContext({
        onTaskCreated: () => {
          this.refreshTaskList();
        },
      })
    ).view() as AngularViewUnit;
  }

  private buildTaskListView(): AngularViewUnit {
    const TaskListUi = registry._cases.tasks.task_list.ui;

    if (!TaskListUi) {
      throw new Error("Portal registry must expose tasks/task_list.ui");
    }

    return new TaskListUi(
      createUiContext({
        refreshToken: this.refreshToken,
        renderCardActions: (task: PortalTask) => this.buildTaskMoveView(task),
      })
    ).view() as AngularViewUnit;
  }

  private buildTaskMoveView(task: PortalTask): AngularViewUnit {
    const TaskMoveUi = registry._cases.tasks.task_move.ui;

    if (!TaskMoveUi) {
      throw new Error("Portal registry must expose tasks/task_move.ui");
    }

    return new TaskMoveUi(
      createUiContext({
        task,
        onTaskMoved: () => {
          this.refreshTaskList();
        },
      })
    ).view() as AngularViewUnit;
  }

  private refreshTaskList(): void {
    this.refreshToken += 1;
    this.taskListView.set(this.buildTaskListView());
  }
}
