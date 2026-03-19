import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import { join } from "node:path";

import { bootstrap } from "../apps/backend/app";

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

async function startServer(dataDirectory: string): Promise<{
  app: ReturnType<typeof bootstrap>;
  server: Server;
  baseUrl: string;
}> {
  const app = bootstrap({
    dataDirectory,
    port: 0,
  });
  const server = await app.startBackend();
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("smoke: failed to resolve backend address");
  }

  return {
    app,
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
      `smoke: ${description} failed with HTTP ${response.status}`
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
      `smoke: ${description} failed: ${
        payload.error?.message ?? "missing success payload"
      }`
    );
  }

  return payload.data;
}

async function run(): Promise<void> {
  const tempDirectory = await mkdtemp(join(os.tmpdir(), "app-angular-smoke-"));
  let server: Server | undefined;

  try {
    let start = await startServer(tempDirectory);
    const initialContext = start.app.createApiContext({
      correlationId: "smoke",
    });

    assert.ok(
      initialContext.cases &&
        "tasks" in initialContext.cases &&
        "task_create" in (initialContext.cases.tasks as Record<string, unknown>),
      "smoke: backend host must materialize ctx.cases"
    );
    assert.ok(
      initialContext.packages &&
        "data" in initialContext.packages,
      "smoke: backend host must materialize ctx.packages"
    );

    server = start.server;

    const health = await parseJson<{ ok: boolean }>(
      await fetch(`${start.baseUrl}/health`),
      "health check"
    );
    assert.equal(health.ok, true, "smoke: health endpoint must be healthy");

    const notFoundResponse = await fetch(`${start.baseUrl}/missing-route`);
    const notFoundPayload = await notFoundResponse.json() as ApiEnvelope<never>;
    assert.equal(notFoundResponse.status, 404, "smoke: unknown route must return 404");
    assert.equal(
      notFoundPayload.error?.code,
      "NOT_FOUND",
      "smoke: unknown route must keep structured errors"
    );

    const invalidJsonResponse = await fetch(`${start.baseUrl}/tasks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{ invalid json",
    });
    const invalidJsonPayload = await invalidJsonResponse.json() as ApiEnvelope<never>;
    assert.equal(
      invalidJsonResponse.status,
      400,
      "smoke: invalid JSON must return HTTP 400"
    );
    assert.equal(
      invalidJsonPayload.error?.code,
      "INVALID_REQUEST",
      "smoke: invalid JSON must keep structured errors"
    );

    const created = await assertSuccess<{ task: Task }>(
      await fetch(`${start.baseUrl}/tasks`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Smoke test task",
          description: "Created by the official smoke test",
        }),
      }),
      "create task"
    );

    assert.equal(
      created.task.status,
      "todo",
      "smoke: new tasks must start in todo"
    );

    const listedBeforeMove = await assertSuccess<{ tasks: Task[] }>(
      await fetch(`${start.baseUrl}/tasks`),
      "list tasks before move"
    );
    assert.equal(
      listedBeforeMove.tasks.some((task) => task.id === created.task.id),
      true,
      "smoke: created task must appear in the list"
    );

    const moved = await assertSuccess<{ task: Task }>(
      await fetch(`${start.baseUrl}/tasks/${created.task.id}/status`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          targetStatus: "doing",
        }),
      }),
      "move task"
    );

    assert.equal(
      moved.task.status,
      "doing",
      "smoke: move must update the task status"
    );

    const listedAfterMove = await assertSuccess<{ tasks: Task[] }>(
      await fetch(`${start.baseUrl}/tasks`),
      "list tasks after move"
    );
    const movedTask = listedAfterMove.tasks.find(
      (task) => task.id === created.task.id
    );
    assert.ok(movedTask, "smoke: moved task must still be listed");
    assert.equal(
      movedTask.status,
      "doing",
      "smoke: list must reflect the moved status"
    );

    const concurrentCreates = await Promise.all(
      Array.from({ length: 8 }, async (_, index) =>
        assertSuccess<{ task: Task }>(
          await fetch(`${start.baseUrl}/tasks`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              title: `Concurrent smoke task ${index + 1}`,
            }),
          }),
          `concurrent create ${index + 1}`
        )
      )
    );

    const concurrentIds = new Set(concurrentCreates.map((item) => item.task.id));
    assert.equal(
      concurrentIds.size,
      concurrentCreates.length,
      "smoke: concurrent creates must return distinct task ids"
    );

    const listedAfterConcurrentCreate = await assertSuccess<{ tasks: Task[] }>(
      await fetch(`${start.baseUrl}/tasks`),
      "list tasks after concurrent create"
    );
    assert.equal(
      listedAfterConcurrentCreate.tasks.length,
      concurrentCreates.length + 1,
      "smoke: concurrent creates must persist every task"
    );

    await closeServer(server);
    server = undefined;

    start = await startServer(tempDirectory);
    server = start.server;

    const listedAfterRestart = await assertSuccess<{ tasks: Task[] }>(
      await fetch(`${start.baseUrl}/tasks`),
      "list tasks after restart"
    );
    const persistedTask = listedAfterRestart.tasks.find(
      (task) => task.id === created.task.id
    );
    assert.ok(
      persistedTask,
      "smoke: task must still exist after backend restart"
    );
    assert.equal(
      persistedTask.status,
      "doing",
      "smoke: local persistence must survive backend restart"
    );

    console.log("smoke: ok");
  } finally {
    if (server) {
      await closeServer(server).catch(() => undefined);
    }

    await rm(tempDirectory, {
      recursive: true,
      force: true,
    });
  }
}

void run().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "smoke: unexpected failure"
  );
  process.exit(1);
});
