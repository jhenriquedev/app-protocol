/* ========================================================================== *
 * packages/date-utils/format.ts
 * ----------------------------------------------------------------------------
 * Utilitários puros de formatação e manipulação de datas.
 *
 * Protocol-agnostic — não importa de core/, cases/ ou apps/.
 * ========================================================================== */

export const DateUtils = {
  /**
   * Formata Date para string legível.
   * Default: "dd/mm/yyyy" (pt-BR).
   */
  format(date: Date, locale = "pt-BR"): string {
    return date.toLocaleDateString(locale);
  },

  /**
   * Formata Date com hora.
   * Default: "dd/mm/yyyy hh:mm" (pt-BR).
   */
  formatDateTime(date: Date, locale = "pt-BR"): string {
    return date.toLocaleString(locale, {
      dateStyle: "short",
      timeStyle: "short",
    });
  },

  /** Retorna "há X minutos/horas/dias" relativo a agora. */
  timeAgo(date: Date, locale = "pt-BR"): string {
    const now = Date.now();
    const diff = now - date.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

    if (days > 0) return rtf.format(-days, "day");
    if (hours > 0) return rtf.format(-hours, "hour");
    if (minutes > 0) return rtf.format(-minutes, "minute");
    return rtf.format(-seconds, "second");
  },

  /** Verifica se duas datas são o mesmo dia. */
  isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  },

  /** Adiciona dias a uma data (imutável). */
  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },

  /** Diferença em dias entre duas datas. */
  diffDays(a: Date, b: Date): number {
    const msPerDay = 86_400_000;
    return Math.floor((a.getTime() - b.getTime()) / msPerDay);
  },
} as const;
