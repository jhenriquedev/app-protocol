/* ========================================================================== *
 * packages/design-system/index.ts
 * ----------------------------------------------------------------------------
 * Design system puro para o exemplo TypeScript.
 *
 * Retorna specs framework-agnostic consumidas pelos ui.case.ts via
 * ctx.packages.designSystem.
 * ========================================================================== */

interface FormField {
  name: string;
  value: string;
  label: string;
  type: string;
  required?: boolean;
}

interface FeedbackSpec {
  type: "success" | "error";
  message: string;
}

export const DesignSystem = {
  form(config: {
    title: string;
    fields: FormField[];
    submitLabel: string;
    feedback: FeedbackSpec | null;
    meta?: Record<string, unknown>;
    onSubmit: () => void;
  }) {
    return {
      type: "form",
      ...config,
    };
  },

  list(config: {
    title: string;
    filter: unknown;
    items: unknown[];
    feedback: FeedbackSpec | null;
    meta?: Record<string, unknown>;
    onFilter: (value: string) => void;
  }) {
    return {
      type: "list",
      ...config,
    };
  },

  feedback(type: "success" | "error", message: string): FeedbackSpec {
    return { type, message };
  },

  badge(label: string, tone: "neutral" | "success" | "danger" = "neutral") {
    return { label, tone };
  },
} as const;
