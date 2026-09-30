-- Sprint 1 defined CART_ITEMS/ORDER_ITEMS against product_id. Sprint 2
-- changes this FK to sku_id, because price and stock now live on the SKU,
-- not the product (a product can have several SKUs at different prices).
-- This decision is documented in docs/SPRINT_2.md Section 2.
CREATE TABLE IF NOT EXISTS carts (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
    id       SERIAL PRIMARY KEY,
    cart_id  INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    sku_id   INTEGER NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    UNIQUE (cart_id, sku_id)
);

CREATE TABLE IF NOT EXISTS orders (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents >= 0),
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    shipping_address VARCHAR(500) NOT NULL,
    order_date       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sku_id      INTEGER NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    -- Snapshot of price at purchase time - independent of later SKU price changes.
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0)
);
