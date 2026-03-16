/* ========================================================================== *
 * Task Manager Example — Entry Point
 * --------------------------------------------------------------------------
 * Boots the backend, runs a full scenario, and executes all test() methods.
 *
 * Usage: npx tsx run.ts
 * ========================================================================== */

import { ApiContext } from "./core/api.case";
import { StreamContext, StreamEvent } from "./core/stream.case";
import { AgenticContext } from "./core/agentic.case";
import { UiContext } from "./core/ui.case";
import { AppLogger } from "./core/shared/app_base_context";
import { TaskCreateOutput } from "./cases/tasks/task_create/task_create.domain.case";
import { TaskCompleteOutput } from "./cases/tasks/task_complete/task_complete.domain.case";

import {
  db,
  casesMap,
  createApiContext,
  createStreamContext,
  startBackend,
  registry as backendRegistry,
} from "./apps/backend/app";

import { startChatbot } from "./apps/chatbot/app";

/* --------------------------------------------------------------------------
 * Logger
 * ------------------------------------------------------------------------ */

const logger: AppLogger = {
  debug: () => undefined,
  info: (msg, meta) => console.log("[RUN]", msg, meta),
  warn: (msg, meta) => console.warn("[RUN]", msg, meta),
  error: (msg, meta) => console.error("[RUN]", msg, meta),
};

/* --------------------------------------------------------------------------
 * Scenario: full task lifecycle
 * --------------------------------------------------------------------------
 * 1. Create a task via API
 * 2. Simulate task.created stream event → triggers notification via composition
 * 3. Complete the task via API
 * 4. Simulate task.completed stream event → triggers notification
 * 5. List all tasks
 * 6. Verify notifications were created
 * ------------------------------------------------------------------------ */

async function runScenario(): Promise<void> {
  console.log("\n========== SCENARIO: Task Lifecycle ==========\n");

  // Step 1: Create a task
  const createCtx = createApiContext();
  const taskCreateApi = new backendRegistry.tasks.task_create.api(createCtx);
  const createResult = await taskCreateApi.handler({ title: "Buy groceries", description: "Milk, eggs, bread" });

  if (!createResult.success || !createResult.data) {
    throw new Error("Failed to create task");
  }

  const createdTask = createResult.data.task;
  console.log(`1. Task created: "${createdTask.title}" (id: ${createdTask.id}, status: ${createdTask.status})`);

  // Step 2: Simulate task.created stream event
  const streamCtx = createStreamContext();
  const taskCreateStream = new backendRegistry.tasks.task_create.stream(streamCtx);
  const createdEvent: StreamEvent<TaskCreateOutput> = {
    type: "task.created",
    payload: createResult.data,
    idempotencyKey: `task-created-${createdTask.id}`,
  };
  await taskCreateStream.handler(createdEvent);
  console.log("2. Stream: task.created event processed → notification sent");

  // Step 3: Complete the task
  const completeCtx = createApiContext();
  const taskCompleteApi = new backendRegistry.tasks.task_complete.api(completeCtx);
  const completeResult = await taskCompleteApi.handler({ taskId: createdTask.id });

  if (!completeResult.success || !completeResult.data) {
    throw new Error("Failed to complete task");
  }

  const completedTask = completeResult.data.task;
  console.log(`3. Task completed: "${completedTask.title}" (status: ${completedTask.status})`);

  // Step 4: Simulate task.completed stream event
  const streamCtx2 = createStreamContext();
  const taskCompleteStream = new backendRegistry.tasks.task_complete.stream(streamCtx2);
  const completedEvent: StreamEvent<TaskCompleteOutput> = {
    type: "task.completed",
    payload: completeResult.data,
    idempotencyKey: `task-completed-${completedTask.id}`,
  };
  await taskCompleteStream.handler(completedEvent);
  console.log("4. Stream: task.completed event processed → notification sent");

  // Step 5: List all tasks
  const listCtx = createApiContext();
  const taskListApi = new backendRegistry.tasks.task_list.api(listCtx);
  const listResult = await taskListApi.handler({});

  if (!listResult.success || !listResult.data) {
    throw new Error("Failed to list tasks");
  }

  console.log(`5. Tasks listed: ${listResult.data.tasks.length} task(s)`);
  for (const t of listResult.data.tasks) {
    console.log(`   - "${t.title}" (${t.status})`);
  }

  // Step 6: Verify notifications
  console.log(`6. Notifications sent: ${db.notifications.length}`);
  for (const n of db.notifications) {
    console.log(`   - [${n.channel}] ${n.message}`);
  }

  if (db.notifications.length < 2) {
    throw new Error("Expected at least 2 notifications (create + complete)");
  }

  console.log("\n========== SCENARIO PASSED ==========\n");
}

/* --------------------------------------------------------------------------
 * Run all test() methods
 * ------------------------------------------------------------------------ */

async function runTests(): Promise<void> {
  console.log("========== RUNNING TESTS ==========\n");

  let passed = 0;
  let failed = 0;

  // Domain tests
  const { TaskCreateDomain } = await import("./cases/tasks/task_create/task_create.domain.case");
  const { TaskCompleteDomain } = await import("./cases/tasks/task_complete/task_complete.domain.case");
  const { TaskListDomain } = await import("./cases/tasks/task_list/task_list.domain.case");
  const { NotificationSendDomain } = await import("./cases/notifications/notification_send/notification_send.domain.case");

  const domainTests = [
    { name: "task_create.domain", fn: () => new TaskCreateDomain().test() },
    { name: "task_complete.domain", fn: () => new TaskCompleteDomain().test() },
    { name: "task_list.domain", fn: () => new TaskListDomain().test() },
    { name: "notification_send.domain", fn: () => new NotificationSendDomain().test() },
  ];

  // API tests (need ctx.db)
  const apiCtx: ApiContext = { correlationId: "test", logger, db, cases: casesMap };
  const { TaskCreateApi } = await import("./cases/tasks/task_create/task_create.api.case");
  const { TaskCompleteApi } = await import("./cases/tasks/task_complete/task_complete.api.case");
  const { TaskListApi } = await import("./cases/tasks/task_list/task_list.api.case");
  const { NotificationSendApi } = await import("./cases/notifications/notification_send/notification_send.api.case");

  const apiTests = [
    { name: "task_create.api", fn: () => new TaskCreateApi(apiCtx).test() },
    { name: "task_list.api", fn: () => new TaskListApi(apiCtx).test() },
    { name: "notification_send.api", fn: () => new NotificationSendApi(apiCtx).test() },
  ];

  // Stream tests
  const streamCtx: StreamContext = { correlationId: "test", logger, db, cases: casesMap };
  const { TaskCreateStream } = await import("./cases/tasks/task_create/task_create.stream.case");
  const { TaskCompleteStream } = await import("./cases/tasks/task_complete/task_complete.stream.case");
  const { NotificationSendStream } = await import("./cases/notifications/notification_send/notification_send.stream.case");

  const streamTests = [
    { name: "task_create.stream", fn: () => new TaskCreateStream(streamCtx).test() },
    { name: "task_complete.stream", fn: () => new TaskCompleteStream(streamCtx).test() },
    { name: "notification_send.stream", fn: () => new NotificationSendStream(streamCtx).test() },
  ];

  // UI tests (need UiContext with mock api)
  const uiCtx: UiContext = {
    correlationId: "test",
    logger,
    api: {
      async request(config: unknown): Promise<unknown> {
        const { method, url, body } = config as { method: string; url: string; body?: unknown };
        // Mock API responses for UI tests
        if (method === "POST" && url === "/tasks") {
          return {
            task: { id: "test-id", title: (body as { title: string }).title, status: "pending", createdAt: new Date().toISOString() },
          };
        }
        if (method === "GET" && url.startsWith("/tasks")) {
          return { tasks: [] };
        }
        return {};
      },
    },
  };

  const { TaskCreateUi } = await import("./cases/tasks/task_create/task_create.ui.case");
  const { TaskCompleteUi } = await import("./cases/tasks/task_complete/task_complete.ui.case");
  const { TaskListUi } = await import("./cases/tasks/task_list/task_list.ui.case");

  const uiTests = [
    { name: "task_create.ui", fn: () => new TaskCreateUi(uiCtx).test() },
    { name: "task_complete.ui", fn: () => new TaskCompleteUi(uiCtx).test() },
    { name: "task_list.ui", fn: () => new TaskListUi(uiCtx).test() },
  ];

  // Agentic tests
  const agenticCtx: AgenticContext = { correlationId: "test", logger, cases: casesMap };
  const { TaskCreateAgentic } = await import("./cases/tasks/task_create/task_create.agentic.case");
  const { TaskCompleteAgentic } = await import("./cases/tasks/task_complete/task_complete.agentic.case");
  const { TaskListAgentic } = await import("./cases/tasks/task_list/task_list.agentic.case");
  const { NotificationSendAgentic } = await import("./cases/notifications/notification_send/notification_send.agentic.case");

  const agenticTests = [
    { name: "task_create.agentic", fn: () => new TaskCreateAgentic(agenticCtx).test() },
    { name: "task_complete.agentic", fn: () => new TaskCompleteAgentic(agenticCtx).test() },
    { name: "task_list.agentic", fn: () => new TaskListAgentic(agenticCtx).test() },
    { name: "notification_send.agentic", fn: () => new NotificationSendAgentic(agenticCtx).test() },
  ];

  const allTests = [...domainTests, ...apiTests, ...streamTests, ...uiTests, ...agenticTests];

  for (const t of allTests) {
    try {
      await t.fn();
      console.log(`  PASS  ${t.name}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL  ${t.name}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed, ${allTests.length} total\n`);

  if (failed > 0) {
    throw new Error(`${failed} test(s) failed`);
  }

  console.log("========== ALL TESTS PASSED ==========\n");
}

/* --------------------------------------------------------------------------
 * Main
 * ------------------------------------------------------------------------ */

async function main(): Promise<void> {
  // Boot
  await startBackend();
  const chatbot = await startChatbot(casesMap);
  console.log(`Chatbot tools: ${chatbot.tools.map((t) => t.name).join(", ")}`);

  // Scenario
  await runScenario();

  // Tests
  await runTests();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
