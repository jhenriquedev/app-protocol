/* ========================================================================== *
 * Portal App — Registry
 * --------------------------------------------------------------------------
 * Imports only UI surfaces.
 * ========================================================================== */

import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";

import { TaskCreateUi } from "../../cases/tasks/task_create/task_create.ui.case";
import { TaskCompleteUi } from "../../cases/tasks/task_complete/task_complete.ui.case";
import { TaskListUi } from "../../cases/tasks/task_list/task_list.ui.case";

export const registry = {
  tasks: {
    task_create: { ui: TaskCreateUi },
    task_complete: { ui: TaskCompleteUi },
    task_list: { ui: TaskListUi },
  },
} satisfies Record<string, Record<string, AppCaseSurfaces>>;
