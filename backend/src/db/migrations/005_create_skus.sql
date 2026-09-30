-- CAT03/CAT05: Each SKU is the sellable unit. variant_id is nullable so a
-- product with zero variants can still sell via a single default SKU tied
-- directly to the product.
CREATE TABLE IF NOT EXISTS skus (
    id             SERIAL PRIMARY KEY,
    product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
    variant_id     INTEGER REFERENCES variants(id) ON DELETE CASCADE ON UPDATE CASCADE,
    sku_code       VARCHAR(64) NOT NULL UNIQUE,
    -- Money stored as integer minor units (cents) - no floating point.
    price_cents    INTEGER NOT NULL CHECK (price_cents >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skus_product_id ON skus(product_id);
CREATE INDEX IF NOT EXISTS idx_skus_variant_id ON skus(variant_id);
