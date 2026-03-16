/* ========================================================================== *
 * packages/design-system/index.ts
 * ----------------------------------------------------------------------------
 * Design system puro — componentes e tokens visuais.
 *
 * Protocol-agnostic — não importa de core/, cases/ ou apps/.
 * Expostos aos Cases de UI via ctx.packages.designSystem.
 *
 * Em projeto real, cada componente seria um módulo separado.
 * Aqui, exportamos placeholders que demonstram o padrão.
 * ========================================================================== */

/* --------------------------------------------------------------------------
 * Tokens
 * ------------------------------------------------------------------------ */

export const tokens = {
  colors: {
    primary: "#2563eb",
    secondary: "#64748b",
    success: "#16a34a",
    danger: "#dc2626",
    warning: "#d97706",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },
  borderRadius: {
    sm: "0.25rem",
    md: "0.5rem",
    lg: "1rem",
    full: "9999px",
  },
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
  },
} as const;

/* --------------------------------------------------------------------------
 * Component placeholders (framework-agnostic specs)
 * ------------------------------------------------------------------------ */

export interface ButtonProps {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onClick?: () => void;
}

export interface InputProps {
  name: string;
  label?: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "number";
  required?: boolean;
  error?: string;
}

export interface CardProps {
  title?: string;
  subtitle?: string;
  padding?: "sm" | "md" | "lg";
}

/**
 * Namespace agrupando componentes e tokens do design system.
 * Cases acessam via ctx.packages.designSystem.
 */
export const DesignSystem = {
  tokens,
  Button: "Button" as const,
  Input: "Input" as const,
  Card: "Card" as const,
} as const;
