// Reproducible seed data for demonstration and manual QA.
// Run with: npm run seed  (requires DATABASE_URL to point at a migrated DB)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding PageHaven demo data...');

    // --- Users ---------------------------------------------------------
    const adminHash = await bcrypt.hash('AdminPass123!', 10);
    const customerHash = await bcrypt.hash('CustomerPass123!', 10);
    await client.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'admin') ON CONFLICT (email) DO NOTHING`,
      ['admin@pagehaven.test', adminHash, 'PageHaven Admin']
    );
    await client.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'customer') ON CONFLICT (email) DO NOTHING`,
      ['reader@pagehaven.test', customerHash, 'Demo Reader']
    );

    // --- Categories (2 levels) ------------------------------------------
    const fiction = await upsertCategory(client, { name: 'Fiction', slug: 'fiction', parentId: null });
    const scifi = await upsertCategory(client, { name: 'Science Fiction', slug: 'fiction-scifi', parentId: fiction.id });
    const nonFiction = await upsertCategory(client, { name: 'Non-Fiction', slug: 'non-fiction', parentId: null });

    // --- Products ---------------------------------------------------------
    const dune = await upsertProduct(client, {
      categoryId: scifi.id,
      name: 'Dune',
      slug: 'dune',
      author: 'Frank Herbert',
      isbn: '9780441013593',
      description: 'A science fiction epic set on the desert planet Arrakis.',
      status: 'published',
      specifications: { language: 'English', pages: '412', publisher: 'Ace Books' },
    });
    const hobbit = await upsertProduct(client, {
      categoryId: fiction.id,
      name: 'The Hobbit',
      slug: 'the-hobbit',
      author: 'J.R.R. Tolkien',
      isbn: '9780547928227',
      description: "Bilbo Baggins' unexpected journey.",
      status: 'published',
      specifications: { language: 'English', pages: '310', publisher: 'Houghton Mifflin' },
    });
    const sapiens = await upsertProduct(client, {
      categoryId: nonFiction.id,
      name: 'Sapiens: A Brief History of Humankind',
      slug: 'sapiens',
      author: 'Yuval Noah Harari',
      isbn: '9780062316097',
      description: 'A sweeping history of the human species.',
      status: 'published',
      specifications: { language: 'English', pages: '443', publisher: 'Harper' },
    });

    // --- Variants -----------------------------------------------------
    const dunePaper = await upsertVariant(client, dune.id, { format: 'Paperback' });
    const duneHard = await upsertVariant(client, dune.id, { format: 'Hardcover' });
    const hobbitPaper = await upsertVariant(client, hobbit.id, { format: 'Paperback' });
    const hobbitHard = await upsertVariant(client, hobbit.id, { format: 'Hardcover' });
    // Intentionally unavailable combination (CAT04 / seed requirement):
    // the combination exists conceptually but is NOT materialized as a SKU.
    await upsertVariant(client, hobbit.id, { format: "Collector's Edition" });

    // --- SKUs (5 valid SKUs; one deliberately out of stock) -------------
    await upsertSku(client, { productId: dune.id, variantId: dunePaper.id, skuCode: 'DUNE-PB', priceCents: 1499, stockQuantity: 40 });
    await upsertSku(client, { productId: dune.id, variantId: duneHard.id, skuCode: 'DUNE-HC', priceCents: 2499, stockQuantity: 15 });
    await upsertSku(client, { productId: hobbit.id, variantId: hobbitPaper.id, skuCode: 'HOBBIT-PB', priceCents: 1299, stockQuantity: 0 }); // out of stock
    await upsertSku(client, { productId: hobbit.id, variantId: hobbitHard.id, skuCode: 'HOBBIT-HC', priceCents: 2199, stockQuantity: 10 });
    await upsertSku(client, { productId: sapiens.id, variantId: null, skuCode: 'SAPIENS-PB', priceCents: 1699, stockQuantity: 25 });

    console.log('Seed complete.');
    console.log('Admin login: admin@pagehaven.test / AdminPass123!');
    console.log('Customer login: reader@pagehaven.test / CustomerPass123!');
  } finally {
    client.release();
    await pool.end();
  }
}

async function upsertCategory(client, { name, slug, parentId }) {
  const { rows } = await client.query(
    `INSERT INTO categories (name, slug, parent_id) VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING *`,
    [name, slug, parentId]
  );
  return rows[0];
}

async function upsertProduct(client, p) {
  const { rows } = await client.query(
    `INSERT INTO products (category_id, name, slug, author, isbn, description, status, specifications)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING *`,
    [p.categoryId, p.name, p.slug, p.author, p.isbn, p.description, p.status, p.specifications]
  );
  return rows[0];
}

async function upsertVariant(client, productId, optionValues) {
  const existing = await client.query(
    'SELECT * FROM variants WHERE product_id = $1 AND option_values = $2::jsonb',
    [productId, JSON.stringify(optionValues)]
  );
  if (existing.rows.length > 0) return existing.rows[0];
  const { rows } = await client.query(
    `INSERT INTO variants (product_id, option_values) VALUES ($1, $2) RETURNING *`,
    [productId, optionValues]
  );
  return rows[0];
}

async function upsertSku(client, s) {
  const { rows } = await client.query(
    `INSERT INTO skus (product_id, variant_id, sku_code, price_cents, stock_quantity)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (sku_code) DO UPDATE SET price_cents = EXCLUDED.price_cents RETURNING *`,
    [s.productId, s.variantId, s.skuCode, s.priceCents, s.stockQuantity]
  );
  return rows[0];
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
