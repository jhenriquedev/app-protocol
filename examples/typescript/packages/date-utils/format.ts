/* ========================================================================== *
 * packages/date-utils/format.ts
 * ----------------------------------------------------------------------------
 * Utilitários puros de data para o exemplo TypeScript.
 *
 * Protocol-agnostic — não importa de core/, cases/ ou apps/.
 * ========================================================================== */

export const DateUtils = {
  format(date: Date, locale = "en-US"): string {
    return date.toLocaleDateString(locale);
  },

  formatDateTime(date: Date, locale = "en-US"): string {
    return date.toLocaleString(locale, {
      dateStyle: "short",
      timeStyle: "short",
    });
  },

  timeAgo(date: Date, locale = "en-US"): string {
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
} as const;
