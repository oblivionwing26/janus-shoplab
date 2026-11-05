import { formatEur, type Totals } from '@/lib/pricing';

export function TotalsTable({ totals, couponCode }: { totals: Totals; couponCode?: string }) {
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
        <tr>
          <th scope="row">Envío</th>
          <td>{totals.shippingCents === 0 ? 'Gratis' : formatEur(totals.shippingCents)}</td>
        </tr>
        <tr>
          <th scope="row">Total</th>
          <td>
            <strong>{formatEur(totals.totalCents)}</strong>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
