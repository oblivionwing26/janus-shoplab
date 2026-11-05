import { describe, expect, it } from 'vitest';

import { computeTotals, formatEur, SHIPPING_CENTS } from './pricing';

describe('computeTotals', () => {
  it('sums lines and charges shipping below the free-shipping threshold', () => {
    const totals = computeTotals(
      [
        { unitPriceCents: 1299, quantity: 2 },
        { unitPriceCents: 450, quantity: 1 },
      ],
      null,
    );

    expect(totals).toEqual({
      subtotalCents: 3048,
      discountCents: 0,
      shippingCents: SHIPPING_CENTS,
      totalCents: 3048 + SHIPPING_CENTS,
    });
  });

  it('applies the coupon percentage, rounding the discount down', () => {
    const totals = computeTotals([{ unitPriceCents: 999, quantity: 1 }], 15);

    // 999 * 15 / 100 = 149.85 -> 149
    expect(totals.discountCents).toBe(149);
    expect(totals.totalCents).toBe(999 - 149 + SHIPPING_CENTS);
  });

  it('ships for free from 50 EUR after the discount', () => {
    expect(computeTotals([{ unitPriceCents: 5000, quantity: 1 }], null).shippingCents).toBe(0);
    expect(computeTotals([{ unitPriceCents: 5000, quantity: 1 }], 10).shippingCents).toBe(
      SHIPPING_CENTS,
    );
  });

  it('costs nothing for an empty cart', () => {
    expect(computeTotals([], 20)).toEqual({
      subtotalCents: 0,
      discountCents: 0,
      shippingCents: 0,
      totalCents: 0,
    });
  });
});

describe('formatEur', () => {
  it('formats cents as euros', () => {
    expect(formatEur(123456).replace(/\s/g, ' ')).toBe('1234,56 €');
    expect(formatEur(5).replace(/\s/g, ' ')).toBe('0,05 €');
  });
});
