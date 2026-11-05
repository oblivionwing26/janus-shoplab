import Link from 'next/link';
import { redirect } from 'next/navigation';

import { currentUser } from '@/lib/current-user';
import { db } from '@/lib/db';
import { listOrders } from '@/lib/orders';
import { formatEur } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

const dateFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

export default async function OrdersPage() {
  const user = await currentUser();
  if (user === null) redirect('/login');
  const orders = await listOrders(db(), user.id);

  return (
    <>
      <h1>Mis pedidos</h1>
      {orders.length === 0 ? (
        <p>Todavía no has hecho ningún pedido.</p>
      ) : (
        <table aria-label="Pedidos">
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col">Fecha</th>
              <th scope="col">Artículos</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link href={`/orders/${String(order.id)}`}>#{order.id}</Link>
                </td>
                <td>{dateFormat.format(order.createdAt)}</td>
                <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                <td>{formatEur(order.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
