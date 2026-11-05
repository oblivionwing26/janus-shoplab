import { formatEur, type Totals } from '@/lib/pricing';

interface TotalsTableProps {
  totals: Totals;
  couponCode?: string;
  /** When false, the shipping row is left out and the total excludes shipping. */
  showShipping?: boolean;
}

export function TotalsTable({ totals, couponCode, showShipping = true }: TotalsTableProps) {
  const total = showShipping ? totals.totalCents : totals.totalCents - totals.shippingCents;
  return (
    <table aria-label="Totales">
      <tbody>
        <tr>
          <th scope="row">Subtotal</th>
          <td>{formatEur(totals.subtotalCents)}</td>
        </tr>
        {totals.discountCents > 0 && (
          <tr>
            <th scope="row">Descuento{couponCode === undefined ? '' : ` (${couponCode})`}</th>
            <td>−{formatEur(totals.discountCents)}</td>
          </tr>
        )}
        {showShipping && (
          <tr>
            <th scope="row">Envío</th>
            <td>{totals.shippingCents === 0 ? 'Gratis' : formatEur(totals.shippingCents)}</td>
          </tr>
        )}
        <tr>
          <th scope="row">Total</th>
          <td>
            <strong>{formatEur(total)}</strong>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
