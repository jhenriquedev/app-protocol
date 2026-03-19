export type StudioStatus = "backlog" | "active" | "complete";

export interface DocumentProps {
  title: string;
  body: string;
}

export interface ShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  hero: string;
  body: string;
}

export interface NoticeProps {
  tone: "success" | "error";
  message: string;
}

export interface ComposerProps {
  actionPath: string;
  titleValue?: string;
  descriptionValue?: string;
  errorMessage?: string;
}

export interface LaneProps {
  status: StudioStatus;
  title: string;
  caption: string;
  itemCount: number;
  body: string;
}

export interface CardProps {
  title: string;
  description?: string;
  status: StudioStatus;
  meta: string;
  actions?: string;
}

export interface MoveControlProps {
  actionPath: string;
  itemId: string;
  currentStatus: StudioStatus;
  errorMessage?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function statusLabel(status: StudioStatus): string {
  switch (status) {
    case "backlog":
      return "Backlog";
    case "active":
      return "Active";
    case "complete":
      return "Complete";
  }
}

const styles = `
  :root {
    color-scheme: light;
    --page-bg: radial-gradient(circle at top left, #f0efe9 0%, #dfe7f4 45%, #f7f8fb 100%);
    --panel-bg: rgba(255, 255, 255, 0.86);
    --panel-border: rgba(35, 47, 66, 0.09);
    --panel-shadow: 0 18px 45px rgba(25, 36, 58, 0.1);
    --ink: #182132;
    --muted: #596579;
    --accent: #0d5c63;
    --backlog-bg: #fff4d6;
    --backlog-ink: #8b5a00;
    --active-bg: #ddefff;
    --active-ink: #005f8f;
    --complete-bg: #dff5e5;
    --complete-ink: #1e6b3a;
    --error-bg: #ffe0dd;
    --error-ink: #9d2f1c;
    --success-bg: #dff5e5;
    --success-ink: #1e6b3a;
    --button-bg: #182132;
    --button-ink: #ffffff;
    --button-muted: #e9eef6;
  }

  * { box-sizing: border-box; }

  body {
    background: var(--page-bg);
    color: var(--ink);
    font-family: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
    margin: 0;
    min-height: 100vh;
  }

  a, button, input, textarea, select { font: inherit; }

  .shell {
    margin: 0 auto;
    max-width: 1180px;
    padding: 2.4rem 1.2rem 3rem;
  }

  .hero {
    background: linear-gradient(135deg, rgba(13, 92, 99, 0.95), rgba(24, 33, 50, 0.96));
    border-radius: 28px;
    color: white;
    overflow: hidden;
    padding: 2rem;
    position: relative;
  }

  .hero::after {
    background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
    content: "";
    inset: 0;
    position: absolute;
  }

  .hero__content {
    position: relative;
    z-index: 1;
  }

  .hero__eyebrow {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    margin-bottom: 0.6rem;
    opacity: 0.82;
    text-transform: uppercase;
  }

  .hero__title {
    font-size: 3rem;
    line-height: 0.98;
    margin: 0;
    max-width: 13ch;
  }

  .hero__subtitle {
    font-size: 1rem;
    line-height: 1.5;
    margin: 0.9rem 0 0;
    max-width: 42rem;
    opacity: 0.88;
  }

  .stack {
    display: grid;
    gap: 1.2rem;
    margin-top: 1.35rem;
  }

  .panel {
    background: var(--panel-bg);
    backdrop-filter: blur(16px);
    border: 1px solid var(--panel-border);
    border-radius: 24px;
    box-shadow: var(--panel-shadow);
    padding: 1.2rem;
  }

  .notice {
    border-radius: 18px;
    font-weight: 600;
    padding: 0.95rem 1rem;
  }

  .notice--success {
    background: var(--success-bg);
    color: var(--success-ink);
  }

  .notice--error {
    background: var(--error-bg);
    color: var(--error-ink);
  }

  .composer {
    display: grid;
    gap: 0.9rem;
  }

  .composer__row {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  }

  .field {
    display: grid;
    gap: 0.35rem;
  }

  .field__label {
    color: var(--muted);
    font-size: 0.82rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .field__input,
  .field__textarea,
  .field__select {
    background: rgba(255,255,255,0.8);
    border: 1px solid rgba(35,47,66,0.12);
    border-radius: 16px;
    color: var(--ink);
    padding: 0.85rem 0.95rem;
    width: 100%;
  }

  .field__textarea {
    min-height: 5.8rem;
    resize: vertical;
  }

  .button {
    border: none;
    border-radius: 999px;
    cursor: pointer;
    font-weight: 700;
    padding: 0.8rem 1.15rem;
  }

  .button--primary {
    background: var(--button-bg);
    color: var(--button-ink);
  }

  .button--subtle {
    background: var(--button-muted);
    color: var(--ink);
  }

  .board {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .lane__header {
    align-items: center;
    display: flex;
    gap: 0.8rem;
    justify-content: space-between;
    margin-bottom: 0.85rem;
  }

  .lane__title {
    margin: 0;
  }

  .lane__caption {
    color: var(--muted);
    font-size: 0.9rem;
    margin: 0.25rem 0 0;
  }

  .lane__count {
    background: rgba(24, 33, 50, 0.08);
    border-radius: 999px;
    font-size: 0.82rem;
    font-weight: 700;
    padding: 0.3rem 0.65rem;
  }

  .lane__body {
    display: grid;
    gap: 0.85rem;
  }

  .card {
    background: rgba(255,255,255,0.8);
    border: 1px solid rgba(35,47,66,0.1);
    border-radius: 18px;
    padding: 1rem;
  }

  .card__header {
    align-items: start;
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
  }

  .card__title {
    font-size: 1rem;
    margin: 0;
  }

  .card__description {
    color: var(--muted);
    margin: 0.7rem 0 0;
    white-space: pre-wrap;
  }

  .card__meta {
    color: var(--muted);
    font-size: 0.85rem;
    margin-top: 0.8rem;
  }

  .status-pill {
    border-radius: 999px;
    display: inline-flex;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 0.3rem 0.65rem;
  }

  .status-pill--backlog { background: var(--backlog-bg); color: var(--backlog-ink); }
  .status-pill--active { background: var(--active-bg); color: var(--active-ink); }
  .status-pill--complete { background: var(--complete-bg); color: var(--complete-ink); }

  .move-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-top: 0.9rem;
  }

  .move-controls form {
    margin: 0;
  }

  .empty {
    color: var(--muted);
    font-size: 0.95rem;
    margin: 0;
    padding: 0.6rem 0;
  }

  @media (max-width: 960px) {
    .board,
    .composer__row {
      grid-template-columns: 1fr;
    }

    .hero__title {
      font-size: 2.35rem;
    }
  }
`;

export function renderDocument(props: DocumentProps): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(props.title)}</title>
    <style>${styles}</style>
  </head>
  <body>
    ${props.body}
  </body>
</html>`;
}

export function AppShell(props: ShellProps): string {
  return `
    <main class="shell">
      <section class="hero">
        <div class="hero__content">
          <div class="hero__eyebrow">${escapeHtml(props.eyebrow)}</div>
          <h1 class="hero__title">${escapeHtml(props.title)}</h1>
          <p class="hero__subtitle">${escapeHtml(props.subtitle)}</p>
          ${props.hero}
        </div>
      </section>
      <section class="stack">
        ${props.body}
      </section>
    </main>
  `;
}

export function Notice(props: NoticeProps): string {
  return `<div class="notice notice--${props.tone}">${escapeHtml(props.message)}</div>`;
}

export function Composer(props: ComposerProps): string {
  const description = props.descriptionValue ?? "";
  const title = props.titleValue ?? "";
  return `
    <section class="panel composer">
      <form method="post" action="${escapeHtml(props.actionPath)}">
        <div class="composer__row">
          <label class="field">
            <span class="field__label">Title</span>
            <input class="field__input" type="text" name="title" value="${escapeHtml(title)}" required />
          </label>
          <label class="field">
            <span class="field__label">Description</span>
            <textarea class="field__textarea" name="description">${escapeHtml(description)}</textarea>
          </label>
        </div>
        ${
          props.errorMessage
            ? `<div style="margin-top:0.8rem;">${Notice({ tone: "error", message: props.errorMessage })}</div>`
            : ""
        }
        <div style="margin-top:0.95rem;">
          <button class="button button--primary" type="submit">Create work item</button>
        </div>
      </form>
    </section>
  `;
}

export function Lane(props: LaneProps): string {
  return `
    <section class="panel lane">
      <div class="lane__header">
        <div>
          <h2 class="lane__title">${escapeHtml(props.title)}</h2>
          <p class="lane__caption">${escapeHtml(props.caption)}</p>
        </div>
        <span class="lane__count">${props.itemCount}</span>
      </div>
      <div class="lane__body">
        ${props.body}
      </div>
    </section>
  `;
}

export function ItemCard(props: CardProps): string {
  return `
    <article class="card">
      <div class="card__header">
        <div>
          <h3 class="card__title">${escapeHtml(props.title)}</h3>
          ${
            props.description
              ? `<p class="card__description">${escapeHtml(props.description)}</p>`
              : ""
          }
        </div>
        ${StatusPill(props.status)}
      </div>
      <div class="card__meta">${props.meta}</div>
      ${props.actions ?? ""}
    </article>
  `;
}

export function StatusPill(status: StudioStatus): string {
  return `<span class="status-pill status-pill--${status}">${escapeHtml(statusLabel(status))}</span>`;
}

export function MoveControls(props: MoveControlProps): string {
  const targets = (["backlog", "active", "complete"] as StudioStatus[]).filter(
    (status) => status !== props.currentStatus
  );

  return `
    <div class="move-controls">
      ${targets
        .map(
          (status) => `
            <form method="post" action="${escapeHtml(props.actionPath)}">
              <input type="hidden" name="itemId" value="${escapeHtml(props.itemId)}" />
              <input type="hidden" name="targetStatus" value="${status}" />
              <button class="button button--subtle" type="submit">
                Move to ${escapeHtml(statusLabel(status))}
              </button>
            </form>
          `
        )
        .join("")}
    </div>
    ${
      props.errorMessage
        ? `<div style="margin-top:0.6rem;">${Notice({ tone: "error", message: props.errorMessage })}</div>`
        : ""
    }
  `;
}

export function EmptyState(message: string): string {
  return `<p class="empty">${escapeHtml(message)}</p>`;
}

export function Board(lanes: string[]): string {
  return `<section class="board">${lanes.join("")}</section>`;
}
