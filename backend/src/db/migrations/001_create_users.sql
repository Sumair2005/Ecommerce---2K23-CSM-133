-- Sprint 2 extension of Sprint 1 USERS entity.
-- Adds `role` to support authenticated administration (CAT06).
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'customer'
                        CHECK (role IN ('customer', 'admin')),
    shipping_address VARCHAR(500),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
