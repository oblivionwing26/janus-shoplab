import { notFound, redirect } from 'next/navigation';

import { TotalsTable } from '@/components/totals-table';
import { currentUser } from '@/lib/current-user';
import { db } from '@/lib/db';
import { findOrderForUser, PAYMENT_METHODS, type PaymentMethod } from '@/lib/orders';
import { formatEur } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const user = await currentUser();
  if (user === null) redirect('/login');
  const id = Number((await params).id);
  const order = Number.isInteger(id) ? await findOrderForUser(db(), user.id, id) : null;
  if (order === null) notFound();
  const { placed } = await searchParams;

  return (
    <>
      <h1>Pedido #{order.id}</h1>
      {placed === '1' && (
        <p role="status" className="notice">
          ¡Gracias! Tu pedido se ha realizado correctamente.
        </p>
      )}
      <table aria-label="Artículos del pedido">
        <thead>
          <tr>
            <th scope="col">Producto</th>
            <th scope="col">Precio</th>
            <th scope="col">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.productId}>
              <td>{item.name}</td>
              <td>{formatEur(item.unitPriceCents)}</td>
              <td>{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <TotalsTable totals={order} />
      <h2>Envío</h2>
      <p>{order.shippingAddress}</p>
      <h2>Pago</h2>
      <p>{PAYMENT_METHODS[order.paymentMethod as PaymentMethod] ?? order.paymentMethod}</p>
    </>
  );
}
