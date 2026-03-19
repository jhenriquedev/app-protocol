import type { ReactElement } from "react";
import { useState } from "react";

import type { UiContext } from "../../core/ui.case";
import type { PortalRegistry } from "./registry";

interface PortalRootProps {
  registry: PortalRegistry;
  createUiContext: (extra?: Record<string, unknown>) => UiContext;
}

interface PortalTask {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "doing" | "done";
  createdAt: string;
  updatedAt: string;
}

export function PortalRoot(props: PortalRootProps): ReactElement {
  const DesignSystem = props.registry._packages.designSystem;
  const [refreshToken, setRefreshToken] = useState(0);

  const taskCreateContext = props.createUiContext({
    onTaskCreated: () => {
      setRefreshToken((current) => current + 1);
    },
  });

  const taskListContext = props.createUiContext({
    refreshToken,
    renderCardActions: (task: PortalTask) => {
      const TaskMoveUi = props.registry._cases.tasks.task_move.ui;
      const moveContext = props.createUiContext({
        task,
        onTaskMoved: () => {
          setRefreshToken((current) => current + 1);
        },
      });

      return new TaskMoveUi(moveContext).view() as ReactElement;
    },
  });

  const TaskCreateUi = props.registry._cases.tasks.task_create.ui;
  const TaskListUi = props.registry._cases.tasks.task_list.ui;
  const taskCreateView = new TaskCreateUi(taskCreateContext)
    .view() as ReactElement;
  const taskListView = new TaskListUi(taskListContext).view() as ReactElement;

  return (
    <DesignSystem.AppShell
      title="Task Board"
      subtitle="Deno APP example with create, list, and move wired through Cases."
    >
      <DesignSystem.BoardHeader
        title="Board"
        subtitle="Tasks load from the backend and each card can now move across columns."
      />

      {taskCreateView}
      {taskListView}
    </DesignSystem.AppShell>
  );
}
