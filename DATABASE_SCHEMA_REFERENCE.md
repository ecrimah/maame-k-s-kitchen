# Database Schema Reference

**Project:** Maame K's Kitchen  
**Database:** `store_maameks` / `maame_staging` on fleet-postgres (PostgreSQL 16.14)  
**Schemas:** `public` (commerce + CMS), `auth` (Supabase-compatible users)

This document describes tables **actively used** by the application. Less-critical or admin-only tables are summarized at the end.

**Conventions**

- Primary keys: `uuid` unless noted
- Timestamps: `timestamptz`, default `now()`
- Money: `numeric` (CAD for orders after food-restaurant migration)
- JSON snapshots: order addresses stored in `orders.shipping_address` / `billing_address`

---

## Auth Schema (`auth.*`)

Imported wholesale from the Supabase dump. The plain-Postgres auth shim reads/writes these tables.

### `auth.users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK; matches `profiles.id` |
| `email` | text | Login identifier |
| `encrypted_password` | text | bcrypt hash (shim uses bcryptjs) |
| `email_confirmed_at` | timestamptz | |
| `phone` | text | |
| `raw_user_meta_data` | jsonb | Signup metadata |
| `raw_app_meta_data` | jsonb | Includes `role` mirror |
| `created_at` / `updated_at` | timestamptz | |
| `last_sign_in_at` | timestamptz | |

**Keys:** PK `id`; unique on email where applicable.

**App usage:** `/auth/v1/token`, `/auth/v1/signup`, middleware JWT validation.

### Related auth tables (from dump)

| Table | Purpose |
|-------|---------|
| `auth.refresh_tokens` | Refresh token rotation |
| `auth.sessions` | Session tracking (legacy Supabase) |
| `auth.identities` | OAuth identities (unused if password-only) |

---

## Identity & Profiles

### `public.profiles`

Extends `auth.users` with storefront/admin profile data.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, FK → `auth.users(id)` |
| `email` | text | UNIQUE |
| `role` | `user_role` enum | `customer`, `staff`, `admin` |
| `full_name` | text | |
| `phone` | text | |
| `avatar_url` | text | |
| `preferences` | jsonb | |
| `stripe_customer_id` | text | Added by meal-prep migration |

**Indexes:** `idx_profiles_email`, `idx_profiles_role`

**App usage:** Admin gate in middleware, meal-prep Stripe customer linkage.

**Trigger:** `handle_new_user()` creates row on signup.

---

## Catalog

### `public.categories`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | text | |
| `slug` | text | UNIQUE |
| `parent_id` | uuid | Self-FK for hierarchy |
| `image_url` | text | |
| `position` | integer | Sort order |
| `status` | `category_status` | `active` / `inactive` |
| `metadata` | jsonb | e.g. `{ "featured": true, "day_only": "saturday" }` |

**Indexes:** `idx_categories_slug`, `idx_categories_parent`

### `public.products`

Core menu/catalog items.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` / `slug` | text | `slug` UNIQUE |
| `description` / `short_description` | text | |
| `price` | numeric | Base price |
| `compare_at_price` | numeric | |
| `sku` | text | UNIQUE |
| `quantity` | integer | Stock (if `track_quantity`) |
| `track_quantity` | boolean | |
| `category_id` | uuid | FK → categories |
| `status` | `product_status` | `active`, `draft`, etc. |
| `featured` | boolean | |
| `tags` | text[] | GIN index |
| `options` | jsonb | Variant option definitions |
| `metadata` | jsonb | e.g. `offers_protein`, preorder flags |
| `moq` | integer | Minimum order qty (≥ 1) |
| **Restaurant columns** | | From food schema migration |
| `prep_time` | integer | Minutes |
| `spice_level` | integer | 0–3 |
| `is_vegetarian` / `is_vegan` / `is_gluten_free` / `is_halal` | boolean | |
| `allergens` | text[] | |
| `calories` | integer | |
| `is_available_today` | boolean | |
| `ingredients` | text[] | |
| **Availability columns** | | From preorder migration |
| `availability_mode` | text | `standard` \| `preorder` |
| `preorder_lead_hours` | integer | |
| `available_days` | text[] | e.g. `{saturday}` |

**Indexes:** slug, category, status, featured, tags (GIN)

### `public.product_images`

| Column | Type | Notes |
|--------|------|-------|
| `product_id` | uuid | FK → products |
| `url` | text | Storage URL |
| `alt_text` | text | |
| `position` | integer | |
| `media_type` | text | `image` \| `video` |

### `public.product_variants`

Portion sizes and price variants.

| Column | Type | Notes |
|--------|------|-------|
| `product_id` | uuid | FK |
| `name` | text | e.g. Regular, Large |
| `sku` | text | UNIQUE |
| `price` | numeric | |
| `quantity` | integer | Variant-level stock |
| `option1` | text | Portion label |

### `public.proteins`

Choosable protein add-ons (admin `/admin/proteins`).

| Column | Type | Notes |
|--------|------|-------|
| `name` | text | |
| `price_delta` | numeric(10,2) | Extra charge |
| `is_active` | boolean | |
| `position` | integer | |
| `metadata` | jsonb | |

**Index:** `proteins_active_position_idx (is_active, position)`

**App usage:** Read on menu when `products.metadata.offers_protein = true`.

---

## Orders & Commerce

### `public.orders`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `order_number` | text | UNIQUE, customer-facing |
| `user_id` | uuid | FK → auth.users (nullable guest checkout) |
| `email` / `phone` | text | |
| `status` | `order_status` | pending, processing, preparing, shipped, delivered, cancelled, … |
| `payment_status` | `payment_status` | pending, paid, failed, refunded |
| `currency` | text | Default **CAD** |
| `subtotal` / `tax_total` / `shipping_total` / `discount_total` / `total` | numeric | |
| `payment_method` / `payment_provider` | text | Stripe |
| `payment_transaction_id` | text | Stripe payment intent / session id |
| `shipping_address` / `billing_address` | jsonb | Snapshots |
| `metadata` | jsonb | Coupon id, `stock_reduced`, `moolre_reference` (Stripe ref legacy key) |
| `delivery_type` | text | `delivery` \| `pickup` |
| `estimated_delivery_at` | timestamptz | |
| `special_instructions` | text | |
| `payment_reminder_sent` | boolean | Cron reminders |

**Indexes (base + hardening):**

- `idx_orders_order_number`, `idx_orders_status`, `idx_orders_user`
- `idx_orders_pending_reminders` (partial, pending payment)
- `idx_orders_payment_status`, `idx_orders_payment_transaction_id` (partial), `idx_orders_created_at`

### `public.order_items`

| Column | Type | Notes |
|--------|------|-------|
| `order_id` | uuid | FK → orders |
| `product_id` | uuid | FK → products (**nullable** after migration) |
| `variant_id` | uuid | FK → product_variants (nullable) |
| `product_name` / `variant_name` | text | Denormalized for history |
| `quantity` | integer | |
| `unit_price` / `total_price` | numeric | |
| `metadata` | jsonb | Protein choice, notes |

**Index:** `idx_order_items_order`

**Note:** Nullable FKs allow product deletion while preserving order history.

### `public.coupons`

Discount codes — `code` UNIQUE, usage limits, date range, `metadata`.

### `public.customers`

CRM aggregate table (email UNIQUE).

| Column | Type | Notes |
|--------|------|-------|
| `email` | text | UNIQUE |
| `user_id` | uuid | Optional link to auth |
| `total_orders` / `total_spent` | integer / numeric | Updated via `update_customer_stats` |
| `last_order_at` | timestamptz | |

---

## Meal Prep (Stripe Subscriptions)

### `public.subscription_plans`

Plan catalog — meals per week, `price_cents`, Stripe product/price ids, delivery/billing days.

### `public.meal_prep_weeks`

Weekly menu windows — `week_start`, `delivery_date`, `selection_deadline`, `status`.

### `public.meal_prep_week_items`

Dishes offered in a given week (FK week + product).

### `public.meal_prep_subscriptions`

Customer subscription state.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid | FK auth.users |
| `plan_id` | uuid | FK subscription_plans |
| `stripe_subscription_id` | text | UNIQUE |
| `status` | text | active, canceled, incomplete, … |
| `delivery_method` | text | pickup \| doorstep |
| `shipping_address` | jsonb | |

**Partial unique index:** one active sub per user.

### `public.meal_prep_selections`

Per-week meal picks (subscription + week + product UNIQUE).

---

## Events & Restaurant Ops

### `public.kitchen_events`

Chop bar, catering promos, food fest listings (`/events`).

| Column | Type | Notes |
|--------|------|-------|
| `slug` | text | UNIQUE |
| `event_type` | text | chop_bar, catering, food_fest, general |
| `status` | text | draft, published, archived |
| `event_date` / `end_date` | timestamptz | |
| `gallery_urls` / `video_urls` | text[] | |

### `public.daily_menu`

Day-specific product availability (Saturday menu admin).

### `public.catering_requests`

Inbound catering inquiry form data.

### `public.delivery_zones`

Delivery fee / minimum order by zone.

---

## CMS & Store Configuration

### `public.store_settings` / `public.site_settings`

Key-value JSON config (`key` PK).

### `public.cms_content`

Structured CMS blocks.

### `public.banners`

Homepage announcement bars.

### `public.pages`

Static pages.

### `public.navigation_menus` / `public.navigation_items`

Header/footer navigation trees.

### `public.store_modules`

Feature flags for admin sidebar (`id` text PK).

**Seeded modules (hardening):** products, orders, customers, coupons, reviews, subscriptions, events, pos, analytics, notifications.

### `public.blog_posts`

Blog content (slug, status, SEO fields).

---

## Engagement & Support

### `public.reviews` / `public.review_images`

Product reviews (public insert via REST ACL).

### `public.cart_items` / `public.wishlist_items`

Authenticated shopper persistence.

### `public.support_tickets` / `public.support_messages`

Customer support threads.

### `public.return_requests` / `public.return_items`

Returns workflow.

### `public.notifications`

In-app user notifications.

---

## New Tables (Hardening Migration)

### `public.contact_submissions`

| Column | Type | Notes |
|--------|------|-------|
| `name`, `email`, `message` | text | Required |
| `phone`, `subject` | text | Optional |
| `status` | text | new, read, replied, archived |
| `metadata` | jsonb | |

**App:** Contact page public INSERT.

### `public.newsletter_subscribers`

| Column | Type | Notes |
|--------|------|-------|
| `email` | text | UNIQUE |
| `status` | text | active, unsubscribed, bounced |

**App:** Newsletter section public INSERT.

### `public.payment_events`

Stripe webhook audit / idempotency log. See [PAYMENT_DATABASE_AUDIT.md](./PAYMENT_DATABASE_AUDIT.md).

### `public.sms_messages`

SMS delivery audit trail (schema ready; app not yet inserting).

| Column | Type | Notes |
|--------|------|-------|
| `provider` | text | Default `moolre` |
| `recipient_masked` | text | PII-safe display |
| `message_type` | text | |
| `related_order_number` | text | |
| `idempotency_key` | text | Partial unique |
| `status` | text | pending, sent, failed, delivered, skipped |

---

## Core RPC Functions

| Function | Args | Returns | Purpose |
|----------|------|---------|---------|
| `mark_order_paid` | `order_ref text`, `moolre_ref text` | jsonb (order row) | Idempotent paid + stock reduction |
| `upsert_customer_from_order` | order fields | uuid | CRM upsert at checkout |
| `update_customer_stats` | email, order total | void | Increment CRM stats post-payment |
| `reduce_stock_on_order` | order uuid | void | Manual stock decrement |
| `get_all_customer_emails` | — | setof text | Admin export |
| `get_all_customer_phones` | — | setof text | Admin export |
| `is_admin_or_staff` | — | boolean | Legacy RLS helper |
| `handle_new_user` | trigger | — | Creates profile on signup |

---

## Enum Types (selected)

| Type | Values (partial) |
|------|------------------|
| `user_role` | customer, staff, admin |
| `order_status` | pending, processing, preparing, ready_for_pickup, out_for_delivery, shipped, delivered, cancelled, awaiting_payment |
| `payment_status` | pending, paid, failed, refunded |
| `product_status` | active, draft, archived |
| `discount_type` | percentage, fixed |

---

## Foreign Key Map

Auto-generated reference: `lib/db/fk-map.ts` (used by supabase-compat for embed/join hints).

Key relationships:

```
categories ← products ← product_images, product_variants
orders ← order_items → products
auth.users ← profiles, orders.user_id, meal_prep_subscriptions
meal_prep_subscriptions ← meal_prep_selections → meal_prep_weeks, products
```

---

## Tables Summarized (Lower Traffic)

| Table | Purpose |
|-------|---------|
| `addresses` | Saved user addresses |
| `audit_logs` | Admin action audit |
| `order_status_history` | Order status timeline |
| `blog_posts` | Blog (admin) |
| `pages` | Static pages |

These follow the same patterns as the core tables above (uuid PK, timestamps, jsonb metadata where applicable).

---

## Schema Change Process

1. Add migration under `supabase/migrations/` with timestamp prefix
2. Test locally: `npm run db:migrate` with `DATABASE_URL`
3. Apply on VPS to `maame_staging` first, then `store_maameks`
4. Update `lib/db/fk-map.ts` if FK relationships change (regenerate if tooling exists)
5. Update REST ACL in `lib/db/rest-acl.ts` if HTTP access rules change
