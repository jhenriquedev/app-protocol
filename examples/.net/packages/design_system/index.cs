using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Rendering;
using Microsoft.AspNetCore.Components.Web;

namespace AppProtocol.Example.DotNet.Packages.DesignSystem;

public sealed class DesignSystemPackage
{
    public static readonly IReadOnlyList<string> TaskStatuses = new[] { "todo", "doing", "done" };

    public RenderFragment Styles() => builder =>
    {
        builder.OpenElement(0, "style");
        builder.AddContent(1, """
            .app-shell__header { align-items: flex-start; display: flex; gap: 1rem; justify-content: space-between; margin-bottom: 2rem; }
            .app-shell__actions { flex-shrink: 0; }
            .task-board { align-items: start; display: grid; gap: 1rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .task-column { min-height: 320px; }
            .task-card__header { align-items: flex-start; display: flex; gap: 0.75rem; justify-content: space-between; margin-bottom: 0.65rem; }
            .task-card__title { overflow-wrap: anywhere; }
            .move-task-action { display: flex; flex-wrap: wrap; gap: 0.45rem; }
            .task-form-modal__panel { max-height: calc(100vh - 2rem); overflow: auto; width: min(100%, 480px); }
            .task-form-modal__field { display: grid; gap: 0.35rem; }
            .task-form-modal__field-input { box-sizing: border-box; width: 100%; }
            .task-form-modal__actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
            @media (max-width: 1024px) { .task-board { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
            @media (max-width: 760px) {
              .app-shell { padding: 1.25rem 0.9rem 1.75rem !important; }
              .app-shell__header { align-items: stretch; flex-direction: column; margin-bottom: 1.4rem; }
              .app-shell__actions { width: 100%; }
              .app-shell__actions > * { width: 100%; }
              .app-shell__title { font-size: 1.95rem !important; }
              .task-board { grid-template-columns: minmax(0, 1fr); }
              .task-column { min-height: auto; }
              .task-card__header { flex-direction: column; }
              .task-form-modal { align-items: flex-end !important; padding: 0.75rem !important; }
              .task-form-modal__panel { border-radius: 18px !important; max-height: calc(100vh - 1.5rem); width: 100%; }
              .task-form-modal__actions { flex-direction: column-reverse; }
              .task-form-modal__actions button { width: 100%; }
              .create-task-button { width: 100%; }
              .move-task-action button { flex: 1 1 calc(50% - 0.45rem); }
            }
            @media (max-width: 480px) {
              .app-shell__title { font-size: 1.7rem !important; }
              .task-card { padding: 0.85rem !important; }
              .move-task-action button { flex-basis: 100%; }
            }
            """);
        builder.CloseElement();
    };

    public RenderFragment AppShell(
        string title,
        string? subtitle,
        RenderFragment body,
        RenderFragment? actions = null) => builder =>
    {
        builder.OpenElement(0, "div");
        builder.AddAttribute(1, "class", "app-shell");
        builder.AddAttribute(2, "style", "background: linear-gradient(180deg, #f5f7fb 0%, #edf1f7 48%, #fdfefe 100%); color: #1f2430; font-family: \"IBM Plex Sans\", \"Avenir Next\", \"Segoe UI\", sans-serif; min-height: 100vh; padding: 2.5rem 1.5rem 3rem;");
        builder.AddContent(3, Styles());
        builder.OpenElement(4, "div");
        builder.AddAttribute(5, "style", "margin: 0 auto; max-width: 1120px;");

        builder.OpenElement(6, "header");
        builder.AddAttribute(7, "class", "app-shell__header");
        builder.OpenElement(8, "div");
        builder.OpenElement(9, "div");
        builder.AddAttribute(10, "style", "color: #637083; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 0.55rem; text-transform: uppercase;");
        builder.AddContent(11, "APP .NET Example");
        builder.CloseElement();
        builder.OpenElement(12, "h1");
        builder.AddAttribute(13, "class", "app-shell__title");
        builder.AddAttribute(14, "style", "font-size: 2.5rem; line-height: 1.05; margin: 0;");
        builder.AddContent(15, title);
        builder.CloseElement();
        if (!string.IsNullOrWhiteSpace(subtitle))
        {
            builder.OpenElement(16, "p");
            builder.AddAttribute(17, "style", "color: #5f646d; font-size: 1rem; margin: 0.7rem 0 0; max-width: 52rem;");
            builder.AddContent(18, subtitle);
            builder.CloseElement();
        }

        builder.CloseElement();

        if (actions is not null)
        {
            builder.OpenElement(19, "div");
            builder.AddAttribute(20, "class", "app-shell__actions");
            builder.AddContent(21, actions);
            builder.CloseElement();
        }

        builder.CloseElement();
        builder.AddContent(22, body);
        builder.CloseElement();
        builder.CloseElement();
    };

    public RenderFragment BoardHeader(string title, string? subtitle = null) => builder =>
    {
        builder.OpenElement(0, "section");
        builder.AddAttribute(1, "style", "background: #ffffff; border: 1px solid #d8dde6; border-radius: 20px; box-shadow: 0 20px 45px rgba(18, 26, 41, 0.08); margin-bottom: 1.5rem; padding: 1.15rem 1.25rem;");
        builder.OpenElement(2, "h2");
        builder.AddAttribute(3, "style", "font-size: 1.1rem; margin: 0;");
        builder.AddContent(4, title);
        builder.CloseElement();
        if (!string.IsNullOrWhiteSpace(subtitle))
        {
            builder.OpenElement(5, "p");
            builder.AddAttribute(6, "style", "color: #5f646d; margin: 0.45rem 0 0;");
            builder.AddContent(7, subtitle);
            builder.CloseElement();
        }

        builder.CloseElement();
    };

    public RenderFragment CreateTaskButton(
        object receiver,
        bool disabled,
        Func<Task>? onClick) => builder =>
    {
        builder.OpenElement(0, "button");
        builder.AddAttribute(1, "class", "create-task-button");
        builder.AddAttribute(2, "type", "button");
        builder.AddAttribute(3, "disabled", disabled);
        builder.AddAttribute(4, "style", $"border: none; border-radius: 999px; cursor: pointer; font-size: 0.95rem; font-weight: 600; padding: 0.8rem 1.1rem; background: {(disabled ? "#cfd5df" : "#1f2430")}; color: #ffffff; justify-content: center; opacity: {(disabled ? "0.72" : "1")};");
        if (onClick is not null)
        {
            builder.AddAttribute(5, "onclick", EventCallback.Factory.Create<MouseEventArgs>(receiver, onClick));
        }

        builder.AddContent(6, "New Task");
        builder.CloseElement();
    };

    public RenderFragment TaskBoard(RenderFragment children) => builder =>
    {
        builder.OpenElement(0, "section");
        builder.AddAttribute(1, "class", "task-board");
        builder.AddContent(2, children);
        builder.CloseElement();
    };

    public RenderFragment TaskColumn(string title, int count, RenderFragment children) => builder =>
    {
        builder.OpenElement(0, "section");
        builder.AddAttribute(1, "class", "task-column");
        builder.AddAttribute(2, "style", "background: #ffffff; border: 1px solid #d8dde6; border-radius: 20px; box-shadow: 0 20px 45px rgba(18, 26, 41, 0.08); padding: 1rem;");
        builder.OpenElement(3, "div");
        builder.AddAttribute(4, "style", "align-items: center; display: flex; justify-content: space-between; margin-bottom: 0.9rem;");
        builder.OpenElement(5, "h3");
        builder.AddAttribute(6, "style", "font-size: 1rem; margin: 0;");
        builder.AddContent(7, title);
        builder.CloseElement();
        builder.OpenElement(8, "span");
        builder.AddAttribute(9, "style", "background: #edf1f7; border-radius: 999px; color: #425166; font-size: 0.8rem; font-weight: 700; min-width: 2rem; padding: 0.2rem 0.55rem; text-align: center;");
        builder.AddContent(10, count);
        builder.CloseElement();
        builder.CloseElement();
        builder.OpenElement(11, "div");
        builder.AddAttribute(12, "style", "display: grid; gap: 0.85rem;");
        builder.AddContent(13, children);
        builder.CloseElement();
        builder.CloseElement();
    };

    public RenderFragment TaskStatusBadge(string status) => builder =>
    {
        var (background, color) = status switch
        {
            "todo" => ("#fff4cc", "#7a5d00"),
            "doing" => ("#d9efff", "#005a91"),
            "done" => ("#dff7e4", "#0c6a36"),
            _ => ("#edf1f7", "#425166"),
        };

        builder.OpenElement(0, "span");
        builder.AddAttribute(1, "style", $"background: {background}; color: {color}; border-radius: 999px; display: inline-flex; font-size: 0.75rem; font-weight: 700; padding: 0.35rem 0.65rem; text-transform: uppercase;");
        builder.AddContent(2, status);
        builder.CloseElement();
    };

    public RenderFragment TaskCard(
        string title,
        string? description,
        string status,
        RenderFragment? actions = null) => builder =>
    {
        builder.OpenElement(0, "article");
        builder.AddAttribute(1, "class", "task-card");
        builder.AddAttribute(2, "style", "background: #fdfefe; border: 1px solid #e5eaf1; border-radius: 16px; padding: 0.95rem;");
        builder.OpenElement(3, "div");
        builder.AddAttribute(4, "class", "task-card__header");
        builder.OpenElement(5, "h4");
        builder.AddAttribute(6, "class", "task-card__title");
        builder.AddAttribute(7, "style", "font-size: 1rem; margin: 0;");
        builder.AddContent(8, title);
        builder.CloseElement();
        builder.AddContent(9, TaskStatusBadge(status));
        builder.CloseElement();
        if (!string.IsNullOrWhiteSpace(description))
        {
            builder.OpenElement(10, "p");
            builder.AddAttribute(11, "style", "color: #5f646d; font-size: 0.94rem; margin: 0;");
            builder.AddContent(12, description);
            builder.CloseElement();
        }

        if (actions is not null)
        {
            builder.OpenElement(13, "div");
            builder.AddAttribute(14, "style", "margin-top: 0.85rem;");
            builder.AddContent(15, actions);
            builder.CloseElement();
        }

        builder.CloseElement();
    };

    public RenderFragment MoveTaskAction(
        object receiver,
        string currentStatus,
        bool submitting,
        Func<string, Task>? onMove) => builder =>
    {
        builder.OpenElement(0, "div");
        builder.AddAttribute(1, "class", "move-task-action");

        var sequence = 2;
        foreach (var status in TaskStatuses)
        {
            var disabled = submitting || string.Equals(status, currentStatus, StringComparison.Ordinal);
            builder.OpenElement(sequence++, "button");
            builder.AddAttribute(sequence++, "type", "button");
            builder.AddAttribute(sequence++, "disabled", disabled);
            builder.AddAttribute(sequence++, "style", $"border: none; border-radius: 999px; cursor: pointer; font-size: 0.8rem; font-weight: 600; padding: 0.45rem 0.7rem; background: {(disabled ? "#d6dce5" : "#edf1f7")}; color: #2f3745; opacity: {(submitting ? "0.72" : "1")};");
            if (onMove is not null)
            {
                builder.AddAttribute(
                    sequence++,
                    "onclick",
                    EventCallback.Factory.Create<MouseEventArgs>(receiver, () => onMove(status)));
            }

            builder.AddContent(sequence++, $"Move to {status}");
            builder.CloseElement();
        }

        builder.CloseElement();
    };

    public RenderFragment TaskFormModal(
        object receiver,
        bool open,
        string titleValue,
        string descriptionValue,
        bool submitting,
        Func<string, Task>? onTitleChange,
        Func<string, Task>? onDescriptionChange,
        Func<Task>? onClose,
        Func<Task>? onSubmit)
    {
        if (!open)
        {
            return _ => { };
        }

        return builder =>
        {
            builder.OpenElement(0, "div");
            builder.AddAttribute(1, "class", "task-form-modal");
            builder.AddAttribute(2, "style", "align-items: center; background: rgba(18, 26, 41, 0.46); display: flex; inset: 0; justify-content: center; padding: 1rem; position: fixed;");

            builder.OpenElement(3, "div");
            builder.AddAttribute(4, "class", "task-form-modal__panel");
            builder.AddAttribute(5, "style", "background: #ffffff; border: 1px solid #d8dde6; border-radius: 20px; box-shadow: 0 20px 45px rgba(18, 26, 41, 0.08); padding: 1.25rem;");

            builder.OpenElement(6, "h3");
            builder.AddAttribute(7, "style", "margin-top: 0;");
            builder.AddContent(8, "Create task");
            builder.CloseElement();

            builder.OpenElement(9, "label");
            builder.AddAttribute(10, "class", "task-form-modal__field");
            builder.AddAttribute(11, "style", "margin-bottom: 0.85rem;");
            builder.OpenElement(12, "span");
            builder.AddContent(13, "Title");
            builder.CloseElement();
            builder.OpenElement(14, "input");
            builder.AddAttribute(15, "class", "task-form-modal__field-input");
            builder.AddAttribute(16, "disabled", submitting);
            builder.AddAttribute(17, "value", titleValue);
            builder.AddAttribute(18, "style", "border: 1px solid #cad2de; border-radius: 12px; font: inherit; padding: 0.8rem 0.9rem;");
            if (onTitleChange is not null)
            {
                builder.AddAttribute(
                    19,
                    "oninput",
                    EventCallback.Factory.Create<ChangeEventArgs>(
                        receiver,
                        args => onTitleChange(args.Value?.ToString() ?? string.Empty)));
            }

            builder.CloseElement();
            builder.CloseElement();

            builder.OpenElement(20, "label");
            builder.AddAttribute(21, "class", "task-form-modal__field");
            builder.AddAttribute(22, "style", "margin-bottom: 1rem;");
            builder.OpenElement(23, "span");
            builder.AddContent(24, "Description");
            builder.CloseElement();
            builder.OpenElement(25, "textarea");
            builder.AddAttribute(26, "class", "task-form-modal__field-input");
            builder.AddAttribute(27, "disabled", submitting);
            builder.AddAttribute(28, "rows", 4);
            builder.AddAttribute(29, "style", "border: 1px solid #cad2de; border-radius: 12px; font: inherit; padding: 0.8rem 0.9rem; resize: vertical;");
            builder.AddAttribute(30, "value", descriptionValue);
            if (onDescriptionChange is not null)
            {
                builder.AddAttribute(
                    31,
                    "oninput",
                    EventCallback.Factory.Create<ChangeEventArgs>(
                        receiver,
                        args => onDescriptionChange(args.Value?.ToString() ?? string.Empty)));
            }

            builder.CloseElement();
            builder.CloseElement();

            builder.OpenElement(32, "div");
            builder.AddAttribute(33, "class", "task-form-modal__actions");
            builder.OpenElement(34, "button");
            builder.AddAttribute(35, "type", "button");
            builder.AddAttribute(36, "disabled", submitting);
            builder.AddAttribute(37, "style", "border: none; border-radius: 999px; cursor: pointer; font-size: 0.95rem; font-weight: 600; padding: 0.8rem 1.1rem; background: #edf1f7; color: #2f3745;");
            if (onClose is not null)
            {
                builder.AddAttribute(38, "onclick", EventCallback.Factory.Create<MouseEventArgs>(receiver, onClose));
            }

            builder.AddContent(39, "Cancel");
            builder.CloseElement();

            builder.OpenElement(40, "button");
            builder.AddAttribute(41, "type", "button");
            builder.AddAttribute(42, "disabled", submitting);
            builder.AddAttribute(43, "style", "border: none; border-radius: 999px; cursor: pointer; font-size: 0.95rem; font-weight: 600; padding: 0.8rem 1.1rem; background: #1f2430; color: #ffffff;");
            if (onSubmit is not null)
            {
                builder.AddAttribute(44, "onclick", EventCallback.Factory.Create<MouseEventArgs>(receiver, onSubmit));
            }

            builder.AddContent(45, submitting ? "Saving..." : "Save task");
            builder.CloseElement();
            builder.CloseElement();

            builder.CloseElement();
            builder.CloseElement();
        };
    }

    public RenderFragment EmptyColumnState(string message) => builder =>
    {
        builder.OpenElement(0, "div");
        builder.AddAttribute(1, "style", "border: 1px dashed #d1d8e2; border-radius: 14px; color: #637083; font-size: 0.93rem; padding: 1rem;");
        builder.AddContent(2, message);
        builder.CloseElement();
    };
}
