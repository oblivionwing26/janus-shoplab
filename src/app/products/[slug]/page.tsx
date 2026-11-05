import Link from 'next/link';
import { notFound } from 'next/navigation';

import { JsonForm } from '@/components/json-form';
import { MAX_QUANTITY } from '@/lib/cart';
import { findProduct } from '@/lib/catalog';
import { currentUser } from '@/lib/current-user';
import { db } from '@/lib/db';
import { formatEur } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, user] = await Promise.all([findProduct(db(), slug), currentUser()]);
  if (product === null) notFound();
  const maxQuantity = Math.min(product.stock, MAX_QUANTITY);

  return (
    <article>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <p>
        <strong>{formatEur(product.priceCents)}</strong>
      </p>

      {product.stock === 0 ? (
        <p>Agotado</p>
      ) : user === null ? (
        <p>
          <Link href="/login">Inicia sesión</Link> para añadirlo al carrito.
        </p>
      ) : (
        <JsonForm action="/api/cart/items" redirectTo="/cart" submitLabel="Añadir al carrito">
          <input type="hidden" name="productId" value={product.id} />
          <label>
            Cantidad
            <select name="quantity" defaultValue="1">
              {Array.from({ length: maxQuantity }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {index + 1}
                </option>
              ))}
            </select>
          </label>
        </JsonForm>
      )}

      <section aria-labelledby="reviews-heading">
        <h2 id="reviews-heading">Reseñas</h2>
        {product.reviews.length === 0 ? (
          <p>Todavía no hay reseñas.</p>
        ) : (
          <ul>
            {product.reviews.map((review) => (
              <li key={review.id}>
                <p>
                  <strong>{review.user.name}</strong> · {review.rating}/5
                </p>
                <p>{review.body}</p>
              </li>
            ))}
          </ul>
        )}
        {user !== null && (
          <JsonForm action={`/api/products/${product.slug}/reviews`} submitLabel="Publicar reseña">
            <label>
              Nota
              <select name="rating" defaultValue="5">
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tu reseña
              <textarea name="body" rows={3} required maxLength={2000} />
            </label>
          </JsonForm>
        )}
      </section>
    </article>
  );
}
