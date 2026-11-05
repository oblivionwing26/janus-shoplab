// Pure pricing rules. Amounts are integer euro cents.

export const SHIPPING_CENTS = 499;
export const FREE_SHIPPING_FROM_CENTS = 5000;

export interface PricedLine {
  unitPriceCents: number;
  quantity: number;
}

export interface Totals {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
}

export function computeTotals(lines: readonly PricedLine[], percentOff: number | null): Totals {
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const discountCents = percentOff === null ? 0 : Math.floor((subtotalCents * percentOff) / 100);
  const afterDiscount = subtotalCents - discountCents;
  const shippingCents =
    lines.length === 0 || afterDiscount >= FREE_SHIPPING_FROM_CENTS ? 0 : SHIPPING_CENTS;
  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: afterDiscount + shippingCents,
  };
}

const eur = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  useGrouping: false,
});

export function formatEur(cents: number): string {
  return eur.format(cents / 100);
}
