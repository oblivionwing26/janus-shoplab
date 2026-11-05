// Seeds ShopLab with synthetic data. Run with `pnpm db:seed` (plain `node`, erasable TS only).
// Idempotent: does nothing if users already exist.
//
// Every test user carries a unique CANARY token in their address. If that token ever shows
// up in a response to a different user, data has leaked: Janus oracles look for exactly that.

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

import pg from 'pg';

import { hashPassword } from '../src/lib/password.ts';

if (process.env.DATABASE_URL === undefined && existsSync('.env')) process.loadEnvFile('.env');

// Test credentials for this demo app only. All people and places are fictitious.
export const TEST_USERS = [
  {
    email: 'ana@shoplab.test',
    password: 'ana-shoplab-1',
    name: 'Ana Prueba',
    address: 'Calle Ficticia 1, 4ºB, 28013 Madrid · CANARY-ANA-7Q3X',
  },
  {
    email: 'bruno@shoplab.test',
    password: 'bruno-shoplab-2',
    name: 'Bruno Ejemplo',
    address: 'Avenida Inventada 22, 08001 Barcelona · CANARY-BRUNO-K9M2',
  },
  {
    email: 'carla@shoplab.test',
    password: 'carla-shoplab-3',
    name: 'Carla Demo',
    address: 'Plaza Imaginaria 5, 41001 Sevilla · CANARY-CARLA-T4W8',
  },
] as const;

const PRODUCTS = [
  ['taza-ceramica', 'Taza de cerámica', 'Taza de 350 ml apta para lavavajillas.', 1290, 40],
  ['cuaderno-a5', 'Cuaderno A5 punteado', '120 hojas de 100 g, tapa dura.', 990, 60],
  ['boligrafo-gel', 'Bolígrafo de gel (pack 3)', 'Tinta negra de secado rápido.', 450, 100],
  ['mochila-urbana', 'Mochila urbana 20 L', 'Compartimento acolchado para portátil.', 4990, 15],
  ['botella-acero', 'Botella de acero 750 ml', 'Mantiene el frío 24 h.', 1990, 30],
  ['lampara-escritorio', 'Lámpara de escritorio LED', 'Tres temperaturas de color.', 3490, 12],
  [
    'auriculares-cable',
    'Auriculares con cable',
    'Micrófono integrado, conector de 3,5 mm.',
    1590,
    25,
  ],
  ['alfombrilla-raton', 'Alfombrilla de ratón XL', '80 × 30 cm, base antideslizante.', 1490, 35],
  ['agenda-2027', 'Agenda semanal 2027', 'Vista semanal, cinta marcapáginas.', 1390, 50],
  ['set-acuarelas', 'Set de acuarelas (12 colores)', 'Con pincel de depósito.', 2290, 20],
  ['soporte-portatil', 'Soporte para portátil', 'Aluminio, seis alturas.', 2790, 18],
  ['planta-artificial', 'Planta artificial pequeña', 'Maceta de cerámica incluida.', 890, 0],
] as const;

const COUPONS = [
  ['BIENVENIDA10', 10, true],
  ['VERANO20', 20, true],
  ['CADUCADO15', 15, false],
] as const;

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ count: string }>('SELECT count(*) FROM users');
    if (Number(rows[0]?.count ?? 0) > 0) {
      console.log('ShopLab already seeded; nothing to do.');
      return;
    }

    await client.query('BEGIN');
    const productIds = new Map<string, { id: string; name: string; price: number }>();
    for (const [slug, name, description, price, stock] of PRODUCTS) {
      const id = randomUUID();
      productIds.set(slug, { id, name, price });
      await client.query(
        'INSERT INTO products (id, slug, name, description, price_cents, stock) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, slug, name, description, price, stock],
      );
    }
    for (const [code, percentOff, active] of COUPONS) {
      await client.query(
        'INSERT INTO coupons (id, code, percent_off, active) VALUES ($1, $2, $3, $4)',
        [randomUUID(), code, percentOff, active],
      );
    }

    // Each user gets orders shipped to their canary address.
    const orderPlan: Record<string, [string, number][][]> = {
      'ana@shoplab.test': [
        [
          ['taza-ceramica', 2],
          ['cuaderno-a5', 1],
        ],
        [['mochila-urbana', 1]],
      ],
      'bruno@shoplab.test': [
        [
          ['lampara-escritorio', 1],
          ['boligrafo-gel', 2],
        ],
      ],
      'carla@shoplab.test': [
        [['set-acuarelas', 1]],
        [
          ['botella-acero', 1],
          ['agenda-2027', 1],
        ],
      ],
    };

    for (const user of TEST_USERS) {
      const userId = randomUUID();
      await client.query(
        'INSERT INTO users (id, email, name, password_hash, address) VALUES ($1, $2, $3, $4, $5)',
        [userId, user.email, user.name, await hashPassword(user.password), user.address],
      );
      for (const lines of orderPlan[user.email] ?? []) {
        const items = lines.map(([slug, quantity]) => {
          const product = productIds.get(slug);
          if (product === undefined) throw new Error(`Unknown product ${slug}`);
          return { ...product, quantity };
        });
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const shipping = subtotal >= 5000 ? 0 : 499;
        const order = await client.query<{ id: number }>(
          `INSERT INTO orders (user_id, shipping_address, payment_method, subtotal_cents,
             discount_cents, shipping_cents, total_cents)
           VALUES ($1, $2, 'test-card', $3, 0, $4, $5) RETURNING id`,
          [userId, user.address, subtotal, shipping, subtotal + shipping],
        );
        const orderId = order.rows[0]?.id;
        for (const item of items) {
          await client.query(
            `INSERT INTO order_items (order_id, product_id, name, unit_price_cents, quantity)
             VALUES ($1, $2, $3, $4, $5)`,
            [orderId, item.id, item.name, item.price, item.quantity],
          );
        }
      }
      const reviewed = productIds.get(
        user.email.startsWith('ana') ? 'taza-ceramica' : 'cuaderno-a5',
      );
      if (reviewed !== undefined) {
        await client.query(
          'INSERT INTO reviews (id, product_id, user_id, rating, body) VALUES ($1, $2, $3, $4, $5)',
          [randomUUID(), reviewed.id, userId, 4, `Muy contento con la compra. — ${user.name}`],
        );
      }
    }
    await client.query('COMMIT');
    console.log(
      `Seeded ${String(PRODUCTS.length)} products, ${String(COUPONS.length)} coupons and ${String(TEST_USERS.length)} users.`,
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

await main();
