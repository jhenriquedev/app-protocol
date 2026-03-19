import { BaseUiCase, type UiContext } from "../../../core/ui.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";
import type { TaskListInput, TaskListItem, TaskListOutput } from "./task_list.domain.case";

interface DesignSystemContract {
  Board(lanes: string[]): string;
  EmptyState(message: string): string;
  ItemCard(props: {
    title: string;
    description?: string;
    status: "backlog" | "active" | "complete";
    meta: string;
    actions?: string;
  }): string;
  Lane(props: {
    status: "backlog" | "active" | "complete";
    title: string;
    caption: string;
    itemCount: number;
    body: string;
  }): string;
}

type ExpectedPackagesMap = {
  designSystem?: DesignSystemContract;
};

type TaskListState = {
  items: TaskListItem[];
  errorMessage?: string;
  loaded: boolean;
};

function getDesignSystem(ctx: UiContext): DesignSystemContract {
  const designSystem = (ctx.packages as ExpectedPackagesMap | undefined)?.designSystem;
  if (!designSystem) {
    throw new AppCaseError(
      "INTERNAL",
      "task_list.ui requires ctx.packages.designSystem"
    );
  }

  return designSystem;
}

function getApiClient(ctx: UiContext) {
  if (!ctx.api) {
    throw new AppCaseError("INTERNAL", "task_list.ui requires ctx.api");
  }

  return ctx.api;
}

type TaskListApiResponse = {
  success: boolean;
  data?: TaskListOutput;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export class TaskListUi extends BaseUiCase<TaskListState> {
  constructor(ctx: UiContext) {
    super(ctx, {
      items: [],
      errorMessage: undefined,
      loaded: false,
    });
  }

  public async load(input: TaskListInput = {}): Promise<void> {
    await this._service?.(input);
  }

  public view(): string {
    const designSystem = getDesignSystem(this.ctx);
    const renderActions =
      typeof this.ctx.extra?.renderActions === "function"
        ? (this.ctx.extra.renderActions as (item: TaskListItem) => string)
        : undefined;

    const buckets: Record<"backlog" | "active" | "complete", TaskListItem[]> = {
      backlog: [],
      active: [],
      complete: [],
    };

    for (const item of this.state.items) {
      buckets[item.status].push(item);
    }

    return designSystem.Board([
      designSystem.Lane({
        status: "backlog",
        title: "Backlog",
        caption: "Ideas, requests, and queued work.",
        itemCount: buckets.backlog.length,
        body:
          buckets.backlog.length === 0
            ? designSystem.EmptyState("Nothing is waiting in backlog.")
            : buckets.backlog
                .map((item) =>
                  designSystem.ItemCard({
                    title: item.title,
                    description: item.description,
                    status: item.status,
                    meta: `Created ${item.createdAt.slice(0, 16).replace("T", " ")}`,
                    actions: renderActions?.(item),
                  })
                )
                .join(""),
      }),
      designSystem.Lane({
        status: "active",
        title: "Active",
        caption: "Work currently underway.",
        itemCount: buckets.active.length,
        body:
          buckets.active.length === 0
            ? designSystem.EmptyState("No active work right now.")
            : buckets.active
                .map((item) =>
                  designSystem.ItemCard({
                    title: item.title,
                    description: item.description,
                    status: item.status,
                    meta: `Updated ${item.updatedAt.slice(0, 16).replace("T", " ")}`,
                    actions: renderActions?.(item),
                  })
                )
                .join(""),
      }),
      designSystem.Lane({
        status: "complete",
        title: "Complete",
        caption: "Finished items ready for review.",
        itemCount: buckets.complete.length,
        body:
          buckets.complete.length === 0
            ? designSystem.EmptyState("Completed work will appear here.")
            : buckets.complete
                .map((item) =>
                  designSystem.ItemCard({
                    title: item.title,
                    description: item.description,
                    status: item.status,
                    meta: `Closed ${item.updatedAt.slice(0, 16).replace("T", " ")}`,
                    actions: renderActions?.(item),
                  })
                )
                .join(""),
      }),
    ]);
  }

  protected async _repository(input: TaskListInput): Promise<TaskListApiResponse> {
    return (await getApiClient(this.ctx).request({
      method: "GET",
      url: "/tasks",
      input,
    })) as TaskListApiResponse;
  }

  protected async _service(input: TaskListInput): Promise<void> {
    const response = await this._repository?.(input);
    if (!response?.success || !response.data) {
      throw new AppCaseError(
        response?.error?.code ?? "INTERNAL",
        response?.error?.message ?? "task_list.ui could not load board items"
      );
    }

    this.setState({
      items: response.data.items,
      loaded: true,
      errorMessage: undefined,
    });
  }

  public async test(): Promise<void> {
    const ui = new TaskListUi({
      correlationId: "test-task-list-ui",
      logger: console,
      api: {
        request: async () => ({
          success: true,
          data: {
            items: [
              {
                id: "item_ui",
                title: "Review copy deck",
                status: "active",
                createdAt: "2026-03-18T12:00:00.000Z",
                updatedAt: "2026-03-18T12:10:00.000Z",
              },
            ],
          },
        }),
      },
      packages: {
        designSystem: {
          Board: (lanes: string[]) => lanes.join(""),
          EmptyState: (message: string) => message,
          ItemCard: ({ title }: { title: string }) => `<article>${title}</article>`,
          Lane: ({ title, body }: { title: string; body: string }) =>
            `<section><h2>${title}</h2>${body}</section>`,
        },
      },
    });

    await ui.load({});
    const rendered = ui.view();
    if (!rendered.includes("Review copy deck")) {
      throw new Error("task_list.ui test expected the loaded item title");
    }
  }
}
