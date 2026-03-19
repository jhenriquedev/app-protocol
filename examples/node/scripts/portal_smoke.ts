import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import { join } from "node:path";

import { bootstrap as bootstrapBackend } from "../apps/backend/app";
import { bootstrap as bootstrapPortal } from "../apps/portal/app";

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

async function startBackend(dataDirectory: string): Promise<{
  server: Server;
  baseUrl: string;
}> {
  const app = bootstrapBackend({
    dataDirectory,
    port: 0,
  });
  const server = await app.startBackend();
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("portal_smoke: failed to resolve backend address");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function startPortal(apiBaseURL: string): Promise<{
  server: Server;
  baseUrl: string;
}> {
  const app = bootstrapPortal({
    apiBaseURL,
    port: 0,
  });
  const server = await app.startPortal();
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("portal_smoke: failed to resolve portal address");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function assertBackendTasks(baseUrl: string): Promise<Task[]> {
  const response = await fetch(`${baseUrl}/tasks`);
  const payload = (await response.json()) as {
    success: boolean;
    data?: { tasks: Task[] };
  };

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error("portal_smoke: backend list failed");
  }

  return payload.data.tasks;
}

async function run(): Promise<void> {
  const tempDirectory = await mkdtemp(join(os.tmpdir(), "app-node-portal-smoke-"));
  let backendServer: Server | undefined;
  let portalServer: Server | undefined;

  try {
    const backend = await startBackend(tempDirectory);
    const portal = await startPortal(backend.baseUrl);
    backendServer = backend.server;
    portalServer = portal.server;

    const health = await fetch(`${portal.baseUrl}/health`);
    const healthPayload = (await health.json()) as {
      ok: boolean;
      app: string;
    };
    assert.equal(healthPayload.ok, true, "portal_smoke: health must be healthy");
    assert.equal(
      healthPayload.app,
      "node-example-portal",
      "portal_smoke: health must expose the portal app name"
    );

    const initialBoard = await fetch(`${portal.baseUrl}/`);
    const initialHtml = await initialBoard.text();
    assert.equal(
      initialHtml.includes("Task Board"),
      true,
      "portal_smoke: root page must render the task board shell"
    );
    assert.equal(
      initialHtml.includes("Create Task"),
      true,
      "portal_smoke: root page must render the create-task entry point"
    );

    const createResponse = await fetch(`${portal.baseUrl}/actions/task-create`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        title: "Portal-created task",
        description: "Created through the Node portal host",
      }),
      redirect: "manual",
    });

    assert.equal(
      createResponse.status,
      303,
      "portal_smoke: create action must redirect after success"
    );

    const createdTasks = await assertBackendTasks(backend.baseUrl);
    const createdTask = createdTasks.find((task) => task.title === "Portal-created task");
    assert.ok(createdTask, "portal_smoke: create action must persist the new task");

    const boardAfterCreate = await fetch(`${portal.baseUrl}/`);
    const boardAfterCreateHtml = await boardAfterCreate.text();
    assert.equal(
      boardAfterCreateHtml.includes("Portal-created task"),
      true,
      "portal_smoke: board must render tasks created through the portal action"
    );

    const moveResponse = await fetch(`${portal.baseUrl}/actions/task-move`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        taskId: createdTask.id,
        targetStatus: "doing",
      }),
      redirect: "manual",
    });

    assert.equal(
      moveResponse.status,
      303,
      "portal_smoke: move action must redirect after success"
    );

    const movedTasks = await assertBackendTasks(backend.baseUrl);
    const movedTask = movedTasks.find((task) => task.id === createdTask.id);
    assert.equal(
      movedTask?.status,
      "doing",
      "portal_smoke: move action must update the persisted task status"
    );

    const invalidCreate = await fetch(`${portal.baseUrl}/actions/task-create`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        title: "   ",
        description: "",
      }),
    });
    const invalidHtml = await invalidCreate.text();

    assert.equal(
      invalidCreate.status,
      400,
      "portal_smoke: invalid create must render a 400 error page"
    );
    assert.equal(
      invalidHtml.includes("title must not be empty"),
      true,
      "portal_smoke: invalid create must surface the validation error in the portal"
    );

    console.log("portal_smoke: ok");
  } finally {
    if (portalServer) {
      await closeServer(portalServer);
    }

    if (backendServer) {
      await closeServer(backendServer);
    }

    await rm(tempDirectory, { recursive: true, force: true });
  }
}

await run();
