/* ========================================================================== *
 * packages/money/money.ts
 * ----------------------------------------------------------------------------
 * Biblioteca pura de manipulação monetária.
 *
 * Protocol-agnostic — não importa de core/, cases/ ou apps/.
 * Pode ser usada por qualquer camada acima via ctx.packages.
 * ========================================================================== */

export type CurrencyCode = "BRL" | "USD" | "EUR" | "GBP";

const CURRENCY_DECIMALS: Record<CurrencyCode, number> = {
  BRL: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
};

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  BRL: "R$",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export class Money {
  /** Valor armazenado em centavos (inteiro) para evitar floating point. */
  private readonly cents: number;
  readonly currency: CurrencyCode;

  constructor(amount: number, currency: CurrencyCode) {
    const decimals = CURRENCY_DECIMALS[currency];
    this.cents = Math.round(amount * Math.pow(10, decimals));
    this.currency = currency;
  }

  /** Valor numérico com casas decimais. */
  toNumber(): number {
    const decimals = CURRENCY_DECIMALS[this.currency];
    return this.cents / Math.pow(10, decimals);
  }

  /** Formatação legível: "R$ 1.234,56" / "$ 1,234.56". */
  format(locale?: string): string {
    const resolvedLocale =
      locale ?? (this.currency === "BRL" ? "pt-BR" : "en-US");
    return new Intl.NumberFormat(resolvedLocale, {
      style: "currency",
      currency: this.currency,
    }).format(this.toNumber());
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    const decimals = CURRENCY_DECIMALS[this.currency];
    return new Money(
      (this.cents + other.cents) / Math.pow(10, decimals),
      this.currency
    );
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const decimals = CURRENCY_DECIMALS[this.currency];
    return new Money(
      (this.cents - other.cents) / Math.pow(10, decimals),
      this.currency
    );
  }

  isZero(): boolean {
    return this.cents === 0;
  }

  isPositive(): boolean {
    return this.cents > 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.cents === other.cents;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Currency mismatch: ${this.currency} vs ${other.currency}`
      );
    }
  }
}
