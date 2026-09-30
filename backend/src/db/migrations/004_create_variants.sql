-- CAT03/CAT04: A product may have zero or more variants.
-- option_values is a flat JSON object, e.g. {"format": "Hardcover"}.
-- Uniqueness of option_values per product is enforced in application code
-- (see src/models/variantModel.js) to avoid a brittle JSONB unique index
-- across differently-ordered keys.
CREATE TABLE IF NOT EXISTS variants (
    id            SERIAL PRIMARY KEY,
    product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
    option_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variants_product_id ON variants(product_id);
