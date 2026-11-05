import Link from 'next/link';

import { listProducts } from '@/lib/catalog';
import { db } from '@/lib/db';
import { formatEur } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const products = await listProducts(db());
  return (
    <>
      <h1>Catálogo</h1>
      <ul className="grid">
        {products.map((product) => (
          <li key={product.id} className="card">
            <h2>
              <Link href={`/products/${product.slug}`}>{product.name}</Link>
            </h2>
            <p>{formatEur(product.priceCents)}</p>
            <p>{product.stock > 0 ? `${String(product.stock)} en stock` : 'Agotado'}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
