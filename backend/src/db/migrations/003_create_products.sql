-- CAT02: Product identity. One canonical category per product (see docs/SPRINT_2.md Q2).
CREATE TABLE IF NOT EXISTS products (
    id             SERIAL PRIMARY KEY,
    category_id    INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    name           VARCHAR(255) NOT NULL,
    slug           VARCHAR(280) NOT NULL UNIQUE,
    author         VARCHAR(255),
    isbn           VARCHAR(32),
    description    TEXT,
    status         VARCHAR(20) NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'published')),
    -- Validated JSONB specifications (Sprint 1 decision: JSONB over EAV).
    -- Validation rule: must be a flat JSON object of string keys -> string values
    -- (e.g. {"language": "English", "pages": "320"}); enforced in application code
    -- (src/models/productModel.js) before insert/update, not at DB level.
    specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
