import Link from 'next/link';
import { redirect } from 'next/navigation';

import { JsonForm } from '@/components/json-form';
import { TotalsTable } from '@/components/totals-table';
import { getCart } from '@/lib/cart';
import { currentUser } from '@/lib/current-user';
import { db } from '@/lib/db';
import { PAYMENT_METHODS } from '@/lib/orders';
import { formatEur } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const user = await currentUser();
  if (user === null) redirect('/login');
  const cart = await getCart(db(), user.id);

  if (cart.lines.length === 0) {
    return (
      <>
        <h1>Pago</h1>
        <p>
          Tu carrito está vacío. <Link href="/">Ver el catálogo</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1>Pago</h1>
      <ul aria-label="Resumen del pedido">
        {cart.lines.map((line) => (
          <li key={line.productId}>
            {line.quantity} × {line.name} — {formatEur(line.unitPriceCents * line.quantity)}
          </li>
        ))}
      </ul>
      <p>
        <Link href="/cart">Modificar cantidades</Link>
      </p>
      <TotalsTable
        totals={cart.totals}
        {...(cart.coupon ? { couponCode: cart.coupon.code } : {})}
      />
      <JsonForm
        action="/api/checkout"
        redirectTo="/orders/{orderId}?placed=1"
        submitLabel="Confirmar pedido"
      >
        <label>
          Dirección de envío
          <textarea name="shippingAddress" rows={3} defaultValue={user.address} required />
        </label>
        <fieldset>
          <legend>Método de pago</legend>
          <p>Pago simulado: no se cobra nada ni se piden datos bancarios.</p>
          {Object.entries(PAYMENT_METHODS).map(([value, label], index) => (
            <label key={value}>
              <input type="radio" name="paymentMethod" value={value} defaultChecked={index === 0} />
              {label}
            </label>
          ))}
        </fieldset>
      </JsonForm>
    </>
  );
}
