import Link from 'next/link';

import { JsonForm } from '@/components/json-form';
import { MoreOptions } from '@/components/more-options';
import { TotalsTable } from '@/components/totals-table';
import { getCart, MAX_QUANTITY } from '@/lib/cart';
import { currentUser } from '@/lib/current-user';
import { db } from '@/lib/db';
import { formatEur } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const user = await currentUser();
  if (user === null) {
    return (
      <>
        <h1>Carrito</h1>
        <p>
          <Link href="/login">Inicia sesión</Link> para ver tu carrito.
        </p>
      </>
    );
  }
  const cart = await getCart(db(), user.id);

  return (
    <>
      <h1>Carrito</h1>
      {cart.lines.length === 0 ? (
        <p>
          Tu carrito está vacío. <Link href="/">Ver el catálogo</Link>
        </p>
      ) : (
        <>
          <table aria-label="Productos del carrito">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Precio</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Quitar</th>
              </tr>
            </thead>
            <tbody>
              {cart.lines.map((line) => (
                <tr key={line.productId}>
                  <td>
                    <Link href={`/products/${line.slug}`}>{line.name}</Link>
                  </td>
                  <td>{formatEur(line.unitPriceCents)}</td>
                  <td>
                    <JsonForm
                      action={`/api/cart/items/${line.productId}`}
                      method="PATCH"
                      submitLabel="Actualizar"
                      className="inline-form"
                    >
                      <label>
                        <span className="visually-hidden">Cantidad de {line.name}</span>
                        <select name="quantity" defaultValue={String(line.quantity)}>
                          {Array.from(
                            { length: Math.min(line.stock, MAX_QUANTITY) },
                            (_, index) => (
                              <option key={index + 1} value={index + 1}>
                                {index + 1}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </JsonForm>
                  </td>
                  <td>
                    <JsonForm
                      action={`/api/cart/items/${line.productId}`}
                      method="DELETE"
                      submitLabel={`Quitar ${line.name}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {cart.coupon === null ? (
            <MoreOptions label="Otras opciones">
              <JsonForm
                action="/api/cart/coupon"
                submitLabel="Aplicar cupón"
                className="inline-form"
              >
                <label>
                  Código del cupón
                  <input name="code" autoComplete="off" />
                </label>
              </JsonForm>
            </MoreOptions>
          ) : (
            <JsonForm action="/api/cart/coupon" method="DELETE" submitLabel="Quitar cupón">
              <p>
                Cupón {cart.coupon.code} aplicado (−{cart.coupon.percentOff} %).
              </p>
            </JsonForm>
          )}

          <TotalsTable
            totals={cart.totals}
            showShipping={false}
            {...(cart.coupon ? { couponCode: cart.coupon.code } : {})}
          />
          <p>
            <Link href="/checkout">Ir a pagar</Link>
          </p>
        </>
      )}
    </>
  );
}
