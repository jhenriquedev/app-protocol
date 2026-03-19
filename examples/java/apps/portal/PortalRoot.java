package apps.portal;

import cases.tasks.task_create.TaskCreateUiCase;
import cases.tasks.task_list.TaskListDomainCase;
import cases.tasks.task_list.TaskListUiCase;
import cases.tasks.task_move.TaskMoveDomainCase;
import cases.tasks.task_move.TaskMoveUiCase;
import core.BaseUiCase.UiContext;
import java.util.Map;

public final class PortalRoot {
  @FunctionalInterface
  public interface UiContextFactory {
    UiContext create(Map<String, Object> extra);
  }

  public static final class PageModel {
    public boolean createOpen;
    public String createTitle = "";
    public String createDescription = "";
    public String createError = "";
    public String successMessage = "";
    public String bannerError = "";
  }

  private final PortalRegistry registry;
  private final UiContextFactory createUiContext;

  public PortalRoot(PortalRegistry registry, UiContextFactory createUiContext) {
    this.registry = registry;
    this.createUiContext = createUiContext;
  }

  public String render(PageModel pageModel) throws Exception {
    PortalRegistry.PortalDesignSystemPackage designSystem =
        (PortalRegistry.PortalDesignSystemPackage) registry.packages().get("designSystem");

    TaskCreateUiCase taskCreateUi = new TaskCreateUiCase(createUiContext.create(Map.of(
        "modalOpen", pageModel.createOpen,
        "title", pageModel.createTitle,
        "description", pageModel.createDescription,
        "errorMessage", pageModel.createError,
        "successMessage", pageModel.successMessage
    )));

    TaskListUiCase taskListUi = new TaskListUiCase(createUiContext.create(Map.of(
        "renderCardActions", (TaskListUiCase.RenderCardActions) task -> {
          TaskMoveUiCase moveUi = new TaskMoveUiCase(createUiContext.create(Map.of("task", toMoveTask(task))));
          return moveUi.view();
        }
    )));

    StringBuilder body = new StringBuilder();
    body.append(designSystem.boardHeader(
        "Board",
        "Tasks load from the backend and each card can move across columns."
    ));

    if (pageModel.bannerError != null && !pageModel.bannerError.isBlank()) {
      body.append(designSystem.feedback("error", pageModel.bannerError));
    }

    body.append(taskCreateUi.view());
    body.append(taskListUi.view());

    return designSystem.appShell(
        "Task Board",
        "Java APP example with create, list, and move wired through Cases.",
        null,
        body.toString()
    );
  }

  private TaskMoveDomainCase.Task toMoveTask(TaskListDomainCase.Task task) {
    return new TaskMoveDomainCase.Task(
        task.id(),
        task.title(),
        task.description(),
        task.status(),
        task.createdAt(),
        task.updatedAt()
    );
  }
}
