import Link from 'next/link';
import { redirect } from 'next/navigation';

import { JsonForm } from '@/components/json-form';
import { TotalsTable } from '@/components/totals-table';
import { getCart } from '@/lib/cart';
import { currentUser } from '@/lib/current-user';
import { db } from '@/lib/db';
import { stepUpRequired, verificationCodeFor } from '@/lib/defenses';
import { PAYMENT_METHODS } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const user = await currentUser();
  if (user === null) redirect('/login');
  const cart = await getCart(db(), user.id);
  // The extra check at checkout (F4.2): off unless SHOPLAB_STEP_UP_CHECKOUT is set.
  const account = await db().user.findUnique({
    where: { id: user.id },
    select: { createdAt: true },
  });
  const stepUp = account !== null && stepUpRequired(account.createdAt);

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
      <TotalsTable
        totals={cart.totals}
        {...(cart.coupon ? { couponCode: cart.coupon.code } : {})}
      />
      <JsonForm
        action="/api/checkout"
        redirectTo="/orders/{orderId}?placed=1"
        submitLabel="Confirmar pedido"
      >
        {stepUp && (
          <label>
            Código de verificación
            <input name="verificationCode" inputMode="numeric" autoComplete="off" required />
            <span>
              Para tu seguridad, escribe este código:{' '}
              <strong>{verificationCodeFor(user.id)}</strong>
            </span>
          </label>
        )}
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
