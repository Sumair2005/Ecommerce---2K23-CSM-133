# Sprint 2: Catalog Data Foundation

**Project:** PageHaven — an online bookstore
**Sprint:** 2 of 6 (15-day implementation sprint)
**Repository path:** `backend/` (code) and `docs/SPRINT_2.md` (this document)

---

## 1. Sprint Goal and Scope Boundary

**Goal:** Given a catalog administrator, the system must persist categories, products (books), variants (e.g. Paperback/Hardcover), and SKUs without losing identity, relationship, price, or inventory meaning.

**In scope (implemented):**
- Category tree with stable slugs, self-referential parent, and cycle prevention (CAT01)
- Product creation/editing with status, category assignment, and validated JSONB specifications (CAT02)
- Variants and SKUs with unique SKU codes, integer-cent pricing, and non-negative stock (CAT03/CAT04)
- Database constraints (uniqueness, foreign keys, checks) in addition to API validation (CAT05)
- JWT-authenticated, admin-only CRUD for categories, products, variants, and SKUs (CAT06)
- Migrations, reproducible seed data, and automated tests

**Out of scope (deferred to Sprint 3+, per the Sprint 2 manual):**
Dynamic specification *tables* (we use validated JSONB instead — see Section 2), asset/image upload, public catalog search/reads, publication workflows beyond a simple draft→published gate, payment integration, and the shopper-facing checkout flow.

---

## 2. Link to Sprint 1 Decisions Reused or Changed

Reused from Sprint 1 (`docs/SPRINT_1.md`):
- Tech stack: React frontend (unaffected this sprint), Node.js/Express backend, PostgreSQL database, Redis reserved for later caching.
- Core entities: Users, Products (books), Categories, Orders, Order_Items, Cart, Cart_Items.
- JWT-based authentication, introduced in Sprint 1's feature table, is now actually implemented.

Changed from Sprint 1, with justification:
1. **`users.role` added.** Sprint 1's ERD had no role column. CAT06 requires admin-only write access, so `role` (`customer` | `admin`) was added to distinguish administrators from shoppers.
2. **`cart_items` / `order_items` now reference `sku_id`, not `product_id`.** Sprint 1 modeled price and stock at the product level. Sprint 2's catalog model (Weeks 1–3) moves price and stock to the SKU level, because one book can have several sellable formats at different prices (e.g. Dune Paperback vs. Hardcover). Carts and orders must therefore point at the specific SKU that was actually priced and stocked, not the product as a whole.
3. **`categories` and `products` gained slugs, an `active`/`status` flag, and timestamps**, needed for CAT01/CAT02 but not specified in Sprint 1's minimal ERD.
4. **Specifications stored as validated JSONB on `products`** rather than a separate EAV table set, per the "either/or" allowed by the Sprint 2 manual (Section 5). Justification: the MVP's attribute set (language, page count, publisher, etc.) is simple key→string data with no need for cross-product attribute querying or faceted search yet; JSONB avoids EAV's join overhead for a bookstore of this scope. The validation rule (Section 5 below) is enforced in `productModel.js`, not at the database level, since Postgres has no native "flat string-keyed object" constraint.

---

## 3. Updated ERD and Data Dictionary

```mermaid
erDiagram
    USERS ||--o{ ORDERS : places
    USERS ||--o| CARTS : has
    CATEGORIES ||--o{ CATEGORIES : "parent of"
    CATEGORIES ||--o{ PRODUCTS : contains
    PRODUCTS ||--o{ VARIANTS : has
    PRODUCTS ||--o{ SKUS : "sells via (default)"
    VARIANTS ||--o{ SKUS : materializes
    PRODUCTS ||--o{ ASSETS : displays
    VARIANTS ||--o{ ASSETS : displays
    CARTS ||--|{ CART_ITEMS : contains
    SKUS ||--o{ CART_ITEMS : selected_as
    ORDERS ||--|{ ORDER_ITEMS : contains
    SKUS ||--o{ ORDER_ITEMS : sold_as

    USERS {
        SERIAL id PK
        VARCHAR email UK
        VARCHAR password_hash
        VARCHAR full_name
        VARCHAR role "customer or admin"
        VARCHAR shipping_address
        TIMESTAMP created_at
    }

    CATEGORIES {
        SERIAL id PK
        INTEGER parent_id FK "self-reference, nullable"
        VARCHAR name
        VARCHAR slug UK
        VARCHAR description
        BOOLEAN active
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    PRODUCTS {
        SERIAL id PK
        INTEGER category_id FK
        VARCHAR name
        VARCHAR slug UK
        VARCHAR author
        VARCHAR isbn
        TEXT description
        VARCHAR status "draft or published"
        JSONB specifications "validated flat string map"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    VARIANTS {
        SERIAL id PK
        INTEGER product_id FK
        JSONB option_values "e.g. format: Hardcover"
        TIMESTAMP created_at
    }

    SKUS {
        SERIAL id PK
        INTEGER product_id FK
        INTEGER variant_id FK "nullable"
        VARCHAR sku_code UK
        INTEGER price_cents "integer minor units"
        INTEGER stock_quantity "CHECK >= 0"
        BOOLEAN active
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    ASSETS {
        SERIAL id PK
        INTEGER product_id FK "nullable"
        INTEGER variant_id FK "nullable"
        VARCHAR storage_key
        VARCHAR role "primary or gallery"
        VARCHAR alt_text
        INTEGER sort_order
        TIMESTAMP created_at
    }

    CARTS {
        SERIAL id PK
        INTEGER user_id FK UK "1 cart per user"
        TIMESTAMP updated_at
    }

    CART_ITEMS {
        SERIAL id PK
        INTEGER cart_id FK
        INTEGER sku_id FK
        INTEGER quantity "CHECK > 0"
    }

    ORDERS {
        SERIAL id PK
        INTEGER user_id FK
        INTEGER total_amount_cents
        VARCHAR status
        VARCHAR shipping_address
        TIMESTAMP order_date
    }

    ORDER_ITEMS {
        SERIAL id PK
        INTEGER order_id FK
        INTEGER sku_id FK
        INTEGER quantity "CHECK > 0"
        INTEGER unit_price_cents "price snapshot at purchase"
    }
```

**Cardinality summary:**
| Relationship | Cardinality | Delete/Update policy |
|---|---|---|
| Category → Category (parent) | 1:N, self-referential | `ON DELETE RESTRICT` (can't delete a category with children); cycles rejected in application logic |
| Category → Products | 1:N | `ON DELETE RESTRICT` (a product must keep a valid category) |
| Product → Variants | 1:N | `ON DELETE CASCADE` (deleting a product removes its variants) |
| Product → SKUs | 1:N | `ON DELETE CASCADE` |
| Variant → SKUs | 1:N (nullable — a SKU may skip variants entirely) | `ON DELETE CASCADE` |
| Product/Variant → Assets | 1:N each (nullable pair) | `ON DELETE CASCADE` |
| User → Cart | 1:1 | `ON DELETE CASCADE` |
| Cart → Cart_Items | 1:N | `ON DELETE CASCADE` |
| SKU → Cart_Items | 1:N | `ON DELETE RESTRICT` (a SKU referenced by a live cart can't be hard-deleted; deactivate instead) |
| User → Orders | 1:N | `ON DELETE RESTRICT` |
| Order → Order_Items | 1:N | `ON DELETE CASCADE` |
| SKU → Order_Items | 1:N | `ON DELETE RESTRICT` (order history must survive SKU deactivation) |

Full column-level SQL definitions are in `backend/src/db/migrations/*.sql`.

---

## 4. Administration Route Table with Examples

All routes below require `Authorization: Bearer <token>` for a user with `role = admin` (see Section 5).

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v1/admin/categories` | Create a category |
| `GET` | `/api/v1/admin/categories` | List the category tree |
| `PATCH` | `/api/v1/admin/categories/:id` | Update a category (name, slug, parent, description, active) |
| `PATCH` | `/api/v1/admin/categories/:id/deactivate` | Deactivate a category |
| `POST` | `/api/v1/admin/products` | Create a draft product |
| `GET` | `/api/v1/admin/products` | List all products |
| `GET` | `/api/v1/admin/products/:id` | Get one product |
| `PATCH` | `/api/v1/admin/products/:id` | Update product content or status |
| `POST` | `/api/v1/admin/products/:id/variants` | Add a variant |
| `POST` | `/api/v1/admin/products/:id/skus` | Add a validated SKU |
| `GET` | `/api/v1/admin/products/:id/skus` | List a product's SKUs (with computed `available`) |
| `PATCH` | `/api/v1/admin/skus/:id` | Update price, stock, or active status |
| `POST` | `/api/v1/auth/register` | Create a user (customer by default) |
| `POST` | `/api/v1/auth/login` | Issue a JWT |

### Example request/response evidence

Captured directly from a running instance of the API (in-memory test database, real HTTP layer via Supertest — see Section 7 for how this is reproduced):

**Create a category**
```
POST /api/v1/admin/categories
{ "name": "Fiction", "slug": "fiction" }

-> 201
{ "data": { "id": 1, "name": "Fiction", "slug": "fiction", "parent_id": null,
            "active": true, "created_at": "2026-09-29T19:01:14.575Z", ... } }
```

**Create a product (draft by default)**
```
POST /api/v1/admin/products
{ "name": "The Hobbit", "slug": "the-hobbit", "categoryId": 1, "author": "J.R.R. Tolkien" }

-> 201
{ "data": { "id": 1, "category_id": 1, "name": "The Hobbit", "slug": "the-hobbit",
            "author": "J.R.R. Tolkien", "status": "draft", "specifications": {}, ... } }
```

**Add a variant**
```
POST /api/v1/admin/products/1/variants
{ "optionValues": { "format": "Paperback" } }

-> 201
{ "data": { "id": 1, "product_id": 1, "option_values": { "format": "Paperback" }, ... } }
```

**Add a SKU**
```
POST /api/v1/admin/products/1/skus
{ "variantId": 1, "skuCode": "HOBBIT-PB", "priceCents": 1299, "stockQuantity": 20 }

-> 201
{ "data": { "id": 1, "product_id": 1, "variant_id": 1, "sku_code": "HOBBIT-PB",
            "price_cents": 1299, "stock_quantity": 20, "active": true, ... } }
```

**List products**
```
GET /api/v1/admin/products
-> 200
{ "data": [ { "id": 1, "name": "The Hobbit", "status": "draft", ... } ] }
```

### Error responses (client errors, not server tracebacks)

**Duplicate slug**
```
POST /api/v1/admin/categories  { "name": "Fiction", "slug": "fiction" }
-> 400
{ "error": { "code": "DUPLICATE_SLUG", "message": "slug \"fiction\" is already in use" } }
```

**Duplicate SKU code**
```
POST /api/v1/admin/products/1/skus  { "skuCode": "HOBBIT-PB", "priceCents": 999, "stockQuantity": 5 }
-> 400
{ "error": { "code": "DUPLICATE_SKU_CODE", "message": "sku_code \"HOBBIT-PB\" is already in use" } }
```

**Unauthenticated request**
```
GET /api/v1/admin/categories   (no Authorization header)
-> 401
{ "error": { "code": "UNAUTHENTICATED", "message": "Missing bearer token" } }
```

**Unauthorized (valid token, wrong role)**
```
GET /api/v1/admin/categories   (Authorization: Bearer <customer token>)
-> 403
{ "error": { "code": "UNAUTHORIZED", "message": "Admin role required" } }
```

---

## 5. Data Integrity and Authorization Decisions

**Database-level integrity (CAT05):**
- `categories.slug`, `products.slug`, `skus.sku_code`, `users.email` all have `UNIQUE` constraints.
- All parent/child relationships are enforced with `FOREIGN KEY` constraints and an explicit `ON DELETE` policy (Section 3 table).
- `skus.stock_quantity >= 0` and `skus.price_cents >= 0` are `CHECK` constraints — negative stock or price is rejected by Postgres itself, not only by the API.
- Money is stored as `price_cents` (`INTEGER`, minor units) — no floating-point currency anywhere in the schema.

**Application-level validation (in addition to, not instead of, the above):**
- Category cycle prevention (a category can't become its own ancestor) — checked by walking the parent chain before an update commits.
- `specifications` JSONB is validated as a flat object of string keys → string values before insert/update.
- A product cannot transition to `status: "published"` unless it has at least one **active** SKU (business rule, Section 6, Q1).
- A duplicate variant option-combination for the same product is rejected (CAT04) rather than silently creating a second identical variant.

**Authorization (CAT06):**
- `requireAuth` middleware rejects any admin request with a missing or invalid JWT → `401 UNAUTHENTICATED`.
- `requireAdmin` middleware rejects a validly-authenticated non-admin user → `403 UNAUTHORIZED`.
- Passwords are hashed with bcrypt (10 rounds); plaintext passwords are never stored or logged.

---

## 6. Business Rules and Edge Cases

1. **Can a draft product have no SKU? Can a published product have no sellable SKU?**
   A draft product can have zero SKUs — this is the normal state while an admin is still building the catalog entry. A published product **cannot** have zero active SKUs: `PATCH /products/:id { status: "published" }` is rejected with `NO_SELLABLE_SKU` unless at least one active SKU already exists. Verified in `tests/products.test.js`.

2. **Is a product assigned to one canonical category, many categories, or both? Why?**
   One canonical category (`products.category_id`, `NOT NULL`). A bookstore's primary use case is shelf/genre browsing, and a single category keeps the model and admin UI simple for this MVP. Cross-cutting tags (e.g. "staff pick") are left for a future `product_tags` table rather than overloading `category_id`.

3. **What happens when a parent category is deactivated?**
   `PATCH /categories/:id/deactivate` only flips that category's own `active` flag — child categories and their products are **not** cascaded or deleted, so no data is lost. Sprint 3's public catalog reads are expected to treat "an ancestor is inactive" as "hide this subtree," which is documented here as a backlog item (Section 8) rather than implemented now, since public reads are out of scope for Sprint 2.

4. **How is an out-of-stock SKU represented in a public response?**
   The SKU row is never deleted. `stock_quantity` simply reaches `0`, and the API adds a computed `available` field (`active && stock_quantity > 0`) to every SKU in a response, so a client can show "out of stock" without the SKU disappearing from history, carts, or past orders. Verified in `tests/skus.test.js`.

5. **Can two SKUs share a price? Can a SKU have a price override?**
   Yes to both — every SKU stores its own `price_cents` directly with no inherited "base price" to override, so two SKUs coincidentally having the same price is unremarkable, and every SKU's price is already an independent value by construction.

6. **What prevents negative stock and duplicate SKU codes?**
   Negative stock: rejected at the API layer (`INVALID_STOCK`) and, as a second line of defense, by the database's `CHECK (stock_quantity >= 0)`. Duplicate SKU codes: rejected at the API layer (`DUPLICATE_SKU_CODE`) and backed by the database's `UNIQUE` constraint on `sku_code`.

7. **What happens to a product referenced by a future cart or order after it is deactivated?**
   Carts and orders reference `sku_id`, not `product_id` (Section 2, decision 2). A SKU's `ON DELETE RESTRICT` from `cart_items`/`order_items` means a SKU that's ever been ordered can never be hard-deleted — only deactivated. `order_items.unit_price_cents` snapshots the price at purchase time, so a later price or stock change never alters historical order totals. A cart still holding a since-deactivated SKU is expected to be revalidated at checkout time in Sprint 3 (flagged as "no longer available") rather than silently disappearing.

---

## 7. Seed Data and Demonstration Instructions

Run against a real, migrated Postgres database:
```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL and JWT_SECRET
npm run migrate
npm run seed
```

`npm run seed` (`src/seed/seed.js`) is idempotent (`ON CONFLICT ... DO UPDATE/NOTHING`) and creates:
- **2 category levels:** `Fiction` → `Science Fiction` (child), plus a separate top-level `Non-Fiction`
- **3 products**, one with multiple variants: *Dune* (2 variants: Paperback/Hardcover), *The Hobbit* (3 variants: Paperback, Hardcover, Collector's Edition), *Sapiens* (no variants, sells via a default SKU)
- **5 valid SKUs**, including one deliberately **out of stock** (`HOBBIT-PB`, `stock_quantity: 0`, still `active: true`)
- **1 intentionally unavailable combination**: The Hobbit's "Collector's Edition" variant exists but has **no SKU at all** — demonstrating CAT04 (a missing combination is never faked as a zero-stock SKU; it simply isn't materialized as a SKU)
- An admin user (`admin@pagehaven.test`) and a customer user (`reader@pagehaven.test`)

The admin demonstration flow (create category → product → variant → SKU → retrieve via the API) was executed end-to-end against the same schema running in-memory, with the full request/response evidence reproduced in Section 4.

---

## 8. Test Strategy, Command, and Result

**Strategy:** Tests run against [pg-mem](https://github.com/oguimbal/pg-mem), an in-memory Postgres-compatible engine, with every migration in `src/db/migrations/` applied fresh before each test file. This exercises the **real SQL constraints** (uniqueness, foreign keys, `CHECK`s) rather than mocking the database, while needing no live Postgres server to grade the submission. Supertest drives the Express app the same way a real HTTP client would.

Coverage includes, per the Sprint 2 manual's testing requirements:
- Product and SKU creation with required fields
- Duplicate slug and duplicate SKU code rejection
- Category hierarchy validation, including cycle prevention (both "own parent" and "own ancestor via a descendant")
- Variant/SKU combination rules (duplicate option combinations rejected) and stock rules (negative stock rejected on create and update; out-of-stock represented, not deleted)
- Authorization failure for admin endpoints (no token → 401; wrong role → 403) and success paths (register/login/admin token)

**Command:**
```bash
npm test
# runs: jest --runInBand --forceExit
```

**Result (last recorded run):**
```
PASS tests/skus.test.js
PASS tests/products.test.js
PASS tests/categories.test.js
PASS tests/auth.test.js

Test Suites: 4 passed, 4 total
Tests:       26 passed, 26 total
Snapshots:   0 total
Time:        5.077 s
```

---

## 9. Known Limitations and Sprint 3 Backlog

**Known limitations (by design, per Sprint 2's stated scope):**
- No public (unauthenticated) catalog read endpoints yet — only admin routes exist.
- No asset/image upload — the `assets` table exists in the schema so Sprint 3 doesn't need a breaking migration, but no upload endpoint is implemented.
- Category deactivation does not cascade visibility to descendants; this is deferred to Sprint 3's public-read logic (Section 6, Q3).
- No search or filtering beyond simple `GET` listing.
- `carts`/`orders` tables and their FKs exist (updated to reference `sku_id`) but have no routes yet — cart/checkout is Sprint 3+ per the original Sprint 1 MVP scope.

**Sprint 3 hand-off / backlog:**
1. Dynamic public catalog reads (published products only, with category subtree visibility rules).
2. Asset upload and the `assets` table's actual usage.
3. Publication workflow refinements (e.g. scheduled publish, unpublish reasons).
4. Cart routes that consume `sku_id` and revalidate availability at checkout, per Section 6 Q7.
5. Consider a `product_tags` table if secondary categorization is needed later, per Section 6 Q2.
