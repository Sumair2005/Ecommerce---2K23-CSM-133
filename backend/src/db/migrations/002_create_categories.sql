-- CAT01: Category tree with stable identifiers and slugs.
CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    parent_id   INTEGER REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    name        VARCHAR(150) NOT NULL,
    slug        VARCHAR(160) NOT NULL UNIQUE,
    description VARCHAR(500),
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
