import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import { join } from "node:path";

import { bootstrap as bootstrapAgent } from "../apps/agent/app";
import { bootstrap as bootstrapBackend } from "../apps/backend/app";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
};

type Task = {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "doing" | "done";
  createdAt: string;
  updatedAt: string;
};

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function startServer(
  kind: "backend" | "agent",
  dataDirectory: string
): Promise<{
  server: Server;
  baseUrl: string;
}> {
  if (kind === "backend") {
    const app = bootstrapBackend({
      dataDirectory,
      port: 0,
    });
    const server = await app.startBackend();
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("agentic_smoke: failed to resolve backend address");
    }

    return {
      server,
      baseUrl: `http://127.0.0.1:${address.port}`,
    };
  }

  const app = bootstrapAgent({
    dataDirectory,
    port: 0,
  });
  const server = await app.startAgent();
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("agentic_smoke: failed to resolve agent address");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function parseJson<T>(
  response: Response,
  description: string
): Promise<T> {
  const payload = (await response.json()) as T;

  if (!response.ok) {
    throw new Error(
      `agentic_smoke: ${description} failed with HTTP ${response.status}`
    );
  }

  return payload;
}

async function assertSuccess<T>(
  response: Response,
  description: string
): Promise<T> {
  const payload = await parseJson<ApiEnvelope<T>>(response, description);

  if (!payload.success || payload.data === undefined) {
    throw new Error(
      `agentic_smoke: ${description} failed: ${
        payload.error?.message ?? "missing success payload"
      }`
    );
  }

  return payload.data;
}

async function assertFailure<T>(
  response: Response,
  description: string,
  expectedStatus: number,
  expectedCode: string
): Promise<ApiEnvelope<T>> {
  const payload = (await response.json()) as ApiEnvelope<T>;

  assert.equal(
    response.status,
    expectedStatus,
    `agentic_smoke: ${description} must return HTTP ${expectedStatus}`
  );
  assert.equal(
    payload.success,
    false,
    `agentic_smoke: ${description} must return success=false`
  );
  assert.equal(
    payload.error?.code,
    expectedCode,
    `agentic_smoke: ${description} must expose ${expectedCode}`
  );

  return payload;
}

async function run(): Promise<void> {
  const tempDirectory = await mkdtemp(
    join(os.tmpdir(), "app-react-agentic-smoke-")
  );
  let backendServer: Server | undefined;
  let agentServer: Server | undefined;

  try {
    const backend = await startServer("backend", tempDirectory);
    const agent = await startServer("agent", tempDirectory);
    backendServer = backend.server;
    agentServer = agent.server;

    const catalog = await assertSuccess<{
      systemPrompt: string;
      resources: Array<{ uri: string }>;
      tools: Array<{ publishedName: string; requiresConfirmation: boolean }>;
    }>(
      await fetch(`${agent.baseUrl}/catalog`),
      "agent catalog"
    );

    const toolNames = catalog.tools.map((tool) => tool.publishedName).sort();
    assert.deepEqual(
      toolNames,
      ["task_create", "task_list", "task_move"],
      "agentic_smoke: agent catalog must expose the three task tools"
    );
    assert.equal(
      catalog.systemPrompt.includes("Tool task_create"),
      true,
      "agentic_smoke: /catalog must expose the host global prompt built from the registered tool fragments"
    );
    assert.deepEqual(
      catalog.resources.map((resource) => resource.uri).sort(),
      [
        "app://agent/system/prompt",
        "app://agent/tools/task_create/semantic",
        "app://agent/tools/task_list/semantic",
        "app://agent/tools/task_move/semantic",
      ],
      "agentic_smoke: /catalog must mirror the MCP semantic resources"
    );

    await assertFailure(
      await fetch(`${agent.baseUrl}/tools/task_create/execute`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          input: {
            title: "   ",
          },
        }),
      }),
      "agent invalid task_create",
      400,
      "VALIDATION_FAILED"
    );

    const created = await assertSuccess<{ task: Task }>(
      await fetch(`${agent.baseUrl}/tools/task_create/execute`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Agent-created task",
          description: "Created through apps/agent",
        }),
      }),
      "agent task_create"
    );

    assert.equal(
      created.task.status,
      "todo",
      "agentic_smoke: task_create must create a todo task"
    );

    const listedByAgent = await assertSuccess<{ tasks: Task[] }>(
      await fetch(`${agent.baseUrl}/tools/task_list/execute`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      "agent task_list"
    );

    assert.equal(
      listedByAgent.tasks.some((task) => task.id === created.task.id),
      true,
      "agentic_smoke: task_list must see tasks created via agent"
    );

    const moveWithoutConfirmation = await fetch(
      `${agent.baseUrl}/tools/task_move/execute`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          taskId: created.task.id,
          targetStatus: "doing",
        }),
      }
    );
    const moveWithoutConfirmationPayload =
      (await moveWithoutConfirmation.json()) as ApiEnvelope<never>;

    assert.equal(
      moveWithoutConfirmation.status,
      409,
      "agentic_smoke: task_move must require confirmation"
    );
    assert.equal(
      moveWithoutConfirmationPayload.error?.code,
      "CONFIRMATION_REQUIRED",
      "agentic_smoke: task_move must expose structured confirmation errors"
    );

    await assertFailure(
      await fetch(`${agent.baseUrl}/tools/task_move/execute`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          input: {
            taskId: "missing",
            targetStatus: "done",
          },
          confirmed: true,
        }),
      }),
      "agent task_move missing task",
      404,
      "NOT_FOUND"
    );

    const moved = await assertSuccess<{ task: Task }>(
      await fetch(`${agent.baseUrl}/tools/task_move/execute`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          input: {
            taskId: created.task.id,
            targetStatus: "doing",
          },
          confirmed: true,
        }),
      }),
      "agent task_move"
    );

    assert.equal(
      moved.task.status,
      "doing",
      "agentic_smoke: confirmed task_move must mutate the task"
    );

    const listedByBackend = await assertSuccess<{ tasks: Task[] }>(
      await fetch(`${backend.baseUrl}/tasks`),
      "backend list after agent execution"
    );
    const movedTask = listedByBackend.tasks.find(
      (task) => task.id === created.task.id
    );

    assert.ok(
      movedTask,
      "agentic_smoke: backend must observe tasks mutated by apps/agent"
    );
    assert.equal(
      movedTask.status,
      "doing",
      "agentic_smoke: backend must observe the status written by task_move"
    );

    const backendBurst = 8;
    const agentBurst = 8;
    const concurrentCreates = await Promise.all(
      [
        ...Array.from({ length: backendBurst }, (_, index) =>
          fetch(`${backend.baseUrl}/tasks`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              title: `Backend burst ${index + 1}`,
            }),
          })
        ),
        ...Array.from({ length: agentBurst }, (_, index) =>
          fetch(`${agent.baseUrl}/tools/task_create/execute`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              input: {
                title: `Agent burst ${index + 1}`,
              },
            }),
          })
        ),
      ].map(async (request) =>
        assertSuccess<{ task: Task }>(
          await request,
          "concurrent backend/agent task creation"
        )
      )
    );

    assert.equal(
      concurrentCreates.length,
      backendBurst + agentBurst,
      "agentic_smoke: concurrent creates must all complete"
    );

    const listedAfterConcurrency = await assertSuccess<{ tasks: Task[] }>(
      await fetch(`${backend.baseUrl}/tasks`),
      "backend list after concurrent backend/agent writes"
    );

    assert.equal(
      listedAfterConcurrency.tasks.length,
      1 + backendBurst + agentBurst,
      "agentic_smoke: concurrent backend/agent writes must preserve every task"
    );

    console.log("agentic_smoke: ok");
  } finally {
    if (agentServer) {
      await closeServer(agentServer);
    }

    if (backendServer) {
      await closeServer(backendServer);
    }

    await rm(tempDirectory, { recursive: true, force: true });
  }
}

void run().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "agentic_smoke failed unexpectedly"
  );
  process.exit(1);
});
