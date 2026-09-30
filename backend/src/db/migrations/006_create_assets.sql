-- Schema only in Sprint 2. Asset upload endpoints are out of scope per the
-- Sprint 2 manual and belong to Sprint 3. Table is included now so the
-- Sprint 2 ERD is complete and Sprint 3 does not need a breaking migration.
CREATE TABLE IF NOT EXISTS assets (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
    variant_id  INTEGER REFERENCES variants(id) ON DELETE CASCADE ON UPDATE CASCADE,
    storage_key VARCHAR(500) NOT NULL,
    role        VARCHAR(20) NOT NULL DEFAULT 'gallery'
                    CHECK (role IN ('primary', 'gallery')),
    alt_text    VARCHAR(255),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_assets_product_id ON assets(product_id);
CREATE INDEX IF NOT EXISTS idx_assets_variant_id ON assets(variant_id);
