# CloudflareSub Server Rewrite Design

- Date: 2026-05-15
- Status: Approved in conversation, pending final user review of written spec
- Scope: Second-generation server-side rewrite of CloudflareSub

## 1. Summary

This document defines the second-generation architecture for CloudflareSub as a multi-user, server-hosted web product. The current Cloudflare Worker implementation will be frozen and treated as a reference implementation only. The new system will not use Cloudflare Workers.

The new product will:

- support user registration and login
- isolate all business data by user
- keep the product lightweight rather than introducing a separate admin system
- make the homepage the primary subscription generation tool
- provide a top navigation entry for data management
- publish public subscription links with configurable expiration times
- preserve the exact snapshot used to create each published subscription

The new product will not, in the first phase:

- include IP probing or scheduled optimization features
- include billing, quotas, or multi-tenant organization management
- require background job workers as a mandatory runtime component
- migrate old Worker KV data automatically

## 2. Product Goals

### 2.1 Goals

- Rebuild the project around a server API and database-backed application model.
- Preserve the current subscription parsing and rendering behavior by migrating the reusable core logic from the Worker project.
- Prioritize the homepage subscription workflow over heavy back-office management screens.
- Support multiple users with strict per-user data isolation.
- Allow users to save reusable node-link sets and preferred-address sets.
- Allow users to publish one subscription link at a time for a selected client target.
- Allow users to restore a previous subscription record back into the homepage workflow.

### 2.2 Non-goals

- No Cloudflare Worker compatibility layer.
- No automatic sync from Worker KV to the new database.
- No access-control roles beyond authenticated end users in phase 1.
- No subscription access analytics, audit logs, or task scheduling in phase 1.
- No advanced parsing UI beyond the current text-based input model.

## 3. Current-State Constraints

The current repository is optimized for a Worker-first deployment:

- `src/worker.js` is the HTTP and storage entrypoint.
- `src/core.js` contains reusable parsing, expansion, encryption, and rendering logic.
- `public/` contains a single static-page UI.
- `wrangler.toml` and Workers KV assumptions are specific to the current runtime.

The new implementation must treat the current Worker repository as:

- a source of business rules
- a source of input and output behavior
- a source of tests to preserve compatibility

It must not treat the current runtime shape as the basis of the new architecture.

## 4. Recommended Architecture

### 4.1 High-level approach

Use a TypeScript monorepo with a modular-monolith architecture:

- one frontend application
- one backend API service
- shared packages for subscription logic and common types
- one PostgreSQL database

Redis is not required in phase 1. The public subscription endpoint serves pre-rendered snapshots from PostgreSQL, and there is no hot-path caching or async-task requirement yet. Redis may be introduced in a future phase for cache, rate-limit backing, or job queues.

This is intentionally not a microservice design. The goal is clear separation of concerns without introducing distributed-system overhead.

### 4.2 Runtime components

- `web`: authenticated web application for login, homepage tool flow, and data management
- `api`: Fastify-based HTTP API for auth, data isolation, generation, publishing, and public subscription access
- `postgres`: primary relational database

### 4.3 Monorepo structure

```text
cloudflaresub-next/
├─ apps/
│  ├─ web/
│  └─ api/
├─ packages/
│  ├─ sub-core/
│  ├─ shared/
│  └─ ui/                 # optional, only if shared components become worthwhile
├─ prisma/
├─ deploy/
│  ├─ docker-compose.yml
│  ├─ nginx/
│  └─ env/
├─ docs/
└─ scripts/
```

### 4.4 Technology choices

- Package manager: pnpm (strict dependency isolation, faster installs, prevents phantom dependencies)
- Frontend: React + Vite + TypeScript
- Frontend routing: React Router
- Frontend async state: TanStack Query
- Backend: Node.js + TypeScript + Fastify
- Backend middleware: `@fastify/cors` for cross-origin policy, `@fastify/rate-limit` for auth endpoint protection
- Validation: Zod
- ORM and migrations: Prisma
- Database: PostgreSQL
- Auth: `jose` (ESM-native, Web Crypto based) for JWT access token + refresh token
- Password storage: `@node-rs/bcrypt` (Rust-based, no node-gyp native compilation required) or equivalent

Fastify is preferred over NestJS because the product should stay lightweight and tool-first rather than taking on the feel of a heavy admin platform.

`jsonwebtoken` is not used because it is a CommonJS package that causes interop issues in ESM projects. `bcrypt` is not used because it requires node-gyp native compilation, which is fragile in CI and Docker environments.

## 5. Product Structure

### 5.1 Top-level navigation

After login, users enter the homepage tool directly.

Top navigation:

- `首页`
- `数据管理`
- user area (email display + logout action)

The product should feel like a focused utility with supporting management screens, not a separate administration console.

### 5.2 Authentication views

Routes:

- `/login`
- `/register`

Behavior:

- registration is self-service
- successful registration creates an immediately usable account
- successful login redirects to `/`

### 5.3 Homepage tool

The homepage is the primary workflow and uses a left-right layout.

Left side: configuration generator

- node-link source selector
- editable node-link text area
- preferred-address source selector
- editable preferred-address text area
- generator options:
  - name prefix
  - keep original Host/SNI
- `生成节点` button

Right side: preview and publishing

- generation summary stats (source node count, endpoint count, expanded node count)
- preview node list
- per-node delete action
- selected subscription target
- expiration-time input (datetime picker)
- remark input
- `生成订阅` button

After successful publish, the result area shows:

- public subscription link
- copy action
- QR code action (for mobile client scanning)
- quick link to subscription management

### 5.4 Data management

Data management is a lightweight working area, not a separate admin system.

Sections:

- `节点链接`
- `优选地址`
- `订阅管理`

#### 5.4.1 Node-link management

Each item is a reusable dataset containing multi-line raw node-link text.

List fields:

- name
- updated time
- short content summary

Actions:

- create
- edit
- delete

#### 5.4.2 Preferred-address management

Each item is a reusable dataset containing multi-line `host[:port][#remark]` text.

List fields:

- name
- updated time
- short content summary

Actions:

- create
- edit
- delete

#### 5.4.3 Subscription management

Each item represents one published subscription.

List fields:

- remark
- subscription type
- created time
- expiration time
- link status

Actions:

- details
- copy
- delete
- restore

Details modal content:

- original node-link input
- original preferred-address input
- generator options
- preview-node snapshot
- subscription type
- public link
- expiration time

Restore behavior:

- return the saved inputs and options to the homepage
- send the user back to the homepage tool
- require the user to regenerate preview nodes before publishing again

Restore does not automatically republish a subscription.

## 6. Core Business Modules

### 6.1 `auth`

Responsibilities:

- register users
- authenticate users
- refresh sessions
- revoke sessions
- resolve current user identity

### 6.2 `source-library`

Responsibilities:

- manage reusable node-link datasets
- manage reusable preferred-address datasets
- expose datasets for homepage dropdown selection

### 6.3 `generator`

Responsibilities:

- parse node-link input
- parse preferred-address input
- expand nodes using selected options
- return preview nodes for editing

This module does not publish or persist subscriptions by itself.

### 6.4 `publisher`

Responsibilities:

- accept the final edited preview state
- render the selected subscription format
- create a persisted subscription record
- create a public token and expiration policy
- store the exact snapshot used for publication

### 6.5 `subscription-access`

Responsibilities:

- serve public subscription content from stored snapshots
- validate token existence
- validate expiration
- return the correct content type and body for the published target

### 6.6 `data-management`

Responsibilities:

- list and modify datasets
- list and inspect published subscriptions
- provide restore context back to the homepage

## 7. Data Model

The first phase uses six primary tables.

### 7.1 `users`

Fields:

- `id`
- `email`
- `username`
- `password_hash`
- `status`
- `created_at`
- `updated_at`

Constraints:

- `email` is required and unique
- `username` is optional but unique when present

### 7.2 `user_sessions`

Fields:

- `id`
- `user_id`
- `refresh_token_hash`
- `user_agent`
- `ip_address`
- `expires_at`
- `created_at`
- `revoked_at`

Rules:

- store only hashed refresh tokens
- support explicit logout and session rotation

Indexes:

- `user_id` (for session listing and cleanup)

### 7.3 `node_link_sets`

Fields:

- `id`
- `user_id`
- `name`
- `description`
- `content`
- `created_at`
- `updated_at`
- `deleted_at`

Rules:

- `content` stores the full multi-line raw node text as PostgreSQL `text` type (not `varchar`)
- records are soft-deleted

Indexes:

- `user_id` (for filtered listing)
- `(user_id, deleted_at)` partial index where `deleted_at IS NULL` (for active-only queries)

### 7.4 `preferred_address_sets`

Fields:

- `id`
- `user_id`
- `name`
- `description`
- `content`
- `created_at`
- `updated_at`
- `deleted_at`

Rules:

- `content` stores the full multi-line preferred-address text as PostgreSQL `text` type (not `varchar`)
- records are soft-deleted

Indexes:

- `user_id` (for filtered listing)
- `(user_id, deleted_at)` partial index where `deleted_at IS NULL` (for active-only queries)

### 7.5 `subscriptions`

Fields:

- `id`
- `user_id`
- `remark`
- `subscription_type`
- `public_token`
- `status`
- `expires_at`
- `created_at`
- `updated_at`
- `deleted_at`

Rules:

- `public_token` must be unique
- `status` supports at least `active`, `expired`, and `deleted`
- `public_url` is not stored; the API composes it from environment configuration and `public_token`

Indexes:

- `user_id` (for filtered listing)
- `public_token` (unique, for public access lookup)

### 7.6 `subscription_snapshots`

Fields:

- `id`
- `subscription_id`
- `user_id`
- `node_link_set_id`
- `preferred_address_set_id`
- `node_links_input`
- `preferred_addresses_input`
- `generator_options`
- `preview_nodes_json`
- `rendered_content`
- `rendered_content_encoding`
- `created_at`

Rules:

- references to source datasets are optional
- raw inputs are always stored, even if a dataset reference exists
- `preview_nodes_json` stores the final pre-publish node set
- `rendered_content` stores the final published subscription payload as PostgreSQL `text` type
- `node_links_input` and `preferred_addresses_input` use PostgreSQL `text` type

Indexes:

- `subscription_id` (for snapshot lookup by subscription)
- `user_id` (for user-scoped queries)

### 7.7 Isolation rules

All authenticated business queries must scope by `user_id`.

Applies to:

- dataset lists
- dataset details
- subscription lists
- subscription details
- restore operations

Public subscription access is the only non-authenticated path and looks up records by `public_token`.

## 8. Data and Publishing Rules

### 8.1 Generation flow

1. User selects or pastes node links.
2. User selects or pastes preferred addresses.
3. User chooses generator options.
4. User requests preview generation.
5. System returns parsed and expanded preview nodes.
6. User removes unwanted nodes from the preview.

The generation flow is an editing session, not a saved record.

### 8.2 Publish flow

1. User chooses one subscription target.
2. User sets remark and expiration time.
3. User publishes the subscription.
4. System renders final content for the selected target.
5. System creates a `subscriptions` row.
6. System creates a `subscription_snapshots` row with the exact raw inputs, options, preview nodes, and rendered output.
7. System returns the public URL.

### 8.3 Public access rule

Public access returns the stored rendered snapshot rather than recalculating from current datasets.

Reasons:

- published output remains stable
- later dataset edits do not change previously published links
- restore behavior remains consistent with history
- serving public subscriptions is simpler and faster

Behavior difference from the current Worker implementation: the Worker uses `detectTarget(userAgent)` to auto-select output format based on User-Agent headers. The new system does not do this because each published subscription is pre-rendered for a single selected target. The subscription type is chosen at publish time and the rendered output is fixed in the snapshot. This is an intentional simplification.

## 9. API Boundaries

The API should be organized around product actions rather than exposing overly fragmented internal resources.

### 9.1 Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

### 9.2 Source datasets

- `GET /sources/node-links`
- `POST /sources/node-links`
- `PATCH /sources/node-links/:id`
- `DELETE /sources/node-links/:id`

- `GET /sources/preferred-addresses`
- `POST /sources/preferred-addresses`
- `PATCH /sources/preferred-addresses/:id`
- `DELETE /sources/preferred-addresses/:id`

### 9.3 Preview generation

- `POST /generator/preview`

Response includes:

- normalized input echoes when useful
- warnings
- preview node list

### 9.4 Subscription publishing and management

- `POST /subscriptions`
- `GET /subscriptions`
- `GET /subscriptions/:id`
- `DELETE /subscriptions/:id`
- `POST /subscriptions/:id/restore`

### 9.5 Public subscription access

- `GET /subscriptions/public/:token`

## 10. Error Handling

### 10.1 Input validation

Use shared Zod schemas for:

- registration payloads
- dataset create and update payloads
- generator input payloads
- publish payloads

Validation errors must return structured field-level messages suitable for direct UI display.

### 10.2 Generation warnings

The generator should preserve the current project behavior of returning warnings when some lines fail to parse but valid nodes remain.

### 10.3 Expired public links

Expired public links should return a clear non-200 response with a short human-readable explanation. The endpoint should not redirect to authenticated pages.

### 10.4 Deleted source datasets

Deleting a source dataset must not break previously published subscriptions because published content is snapshot-based.

## 11. Security

- Passwords must be hashed with a modern password hashing algorithm.
- Refresh tokens must be stored hashed in the database.
- Access tokens should be short-lived (15 minutes recommended).
- Public subscription tokens must be high-entropy random values.
- User data access must always be filtered by authenticated `user_id`.
- Public subscription tokens must not expose sequential record IDs.
- The API must configure CORS to allow only the web application origin. Wildcard `*` origins must not be used in production.
- Auth endpoints (`/auth/register`, `/auth/login`, `/auth/refresh`) must be rate-limited to prevent brute-force attacks (recommended: 10 requests per minute per IP).
- Access tokens should be stored in memory (not localStorage) on the frontend to reduce XSS exposure. Refresh tokens should be delivered via httpOnly cookies where possible, or stored in localStorage as a fallback with awareness of the XSS tradeoff.
- All production traffic must be served over HTTPS.

## 12. Testing Strategy

### 12.1 `packages/sub-core`

Carry over and expand the current behavior tests for:

- node-link parsing
- base64 subscription expansion
- preferred-address parsing
- node expansion
- target rendering

The migrated tests from the current repository form the initial compatibility baseline.

### 12.2 API integration tests

Integration tests run against a real PostgreSQL database, not mocks.

Test database strategy:

- Use a separate `cloudflaresub_next_test` database
- Each test file resets the database before running (Prisma `migrate reset` or transaction-based cleanup)
- Environment variables for the test database are loaded from `.env.test`

Cover:

- register and login
- multi-user data isolation
- dataset CRUD
- preview generation
- subscription publish
- public subscription access
- restore payload generation

### 12.3 Frontend flow tests

Cover the most important paths:

- register or login
- generate preview nodes on the homepage
- delete preview nodes
- publish a subscription
- view subscriptions
- restore a saved subscription into the homepage

## 13. Migration Strategy

### 13.1 Freeze the Worker project

The current Worker repository remains available as a reference implementation only.

Do not:

- extend Worker-specific runtime behavior
- build compatibility layers around Wrangler or KV
- attempt a hybrid runtime

### 13.2 Migrate reusable logic only

Move and refactor:

- `src/core.js` business logic into `packages/sub-core`
- `tests/smoke.mjs` behavior coverage into the new package test suite

The following capabilities from `src/core.js` must be fully ported:

- `maybeExpandRawSubscription`: auto-detect base64-encoded subscription content and decode it before line parsing
- `parseNodeLinks` / `parseSingleNode`: VMess (base64 JSON), VLESS (URL), Trojan (URL) parsing with all field mappings
- `parsePreferredEndpoints`: endpoint parsing with `host[:port][#label]` format, IPv6 bracket support, and host:port deduplication
- `expandNodes`: node expansion with keepOriginalHost/namePrefix options, proper SNI/Host fallback chains, and per-node warnings
- `renderNodeUri` / `renderVmessUri` / `renderVlessUri` / `renderTrojanUri`: node-to-URI serialization (required for raw/v2rayn/shadowrocket output)
- `renderRawSubscription`: base64-encode all node URIs
- `renderClashSubscription`: full YAML output with per-node proxy blocks (TLS, network, ws-opts, grpc-opts, headers), proxy-groups, and rules
- `renderSurgeSubscription`: MANAGED-CONFIG, per-node proxy lines, proxy groups, and rules

The `json` output target from the current `renderSubscription` is intentionally excluded from the first phase. The `encryptPayload` / `decryptPayload` functions are Worker-specific (AES-GCM token generation) and are not migrated; the new system uses database-backed public tokens instead.

Function naming alignment: the current `parsePreferredEndpoints` should be renamed to `parsePreferredAddresses` in `packages/sub-core` to match the new system's terminology.

Do not migrate:

- `src/worker.js`
- `public/` UI structure
- `wrangler.toml`

### 13.3 No automatic historical data migration

Old Worker KV data will not be migrated automatically.

Reasoning:

- the old and new data models are materially different
- the new system introduces users, isolation, datasets, and subscription snapshots
- automated conversion adds complexity with low return for this project stage

If any legacy data must be kept, it should be recreated manually in the new system.

## 14. Delivery Phases

### Phase 1: Core engine migration

- create monorepo scaffold
- create `packages/sub-core`
- migrate parsing and rendering logic
- add TypeScript types
- port and expand compatibility tests

### Phase 2: Backend product closure

- create Prisma schema
- implement auth
- implement multi-user isolation
- implement source dataset CRUD
- implement preview generation
- implement subscription publishing
- implement public subscription serving
- implement subscription restore API

### Phase 3: Frontend product closure

- implement login and register pages
- implement homepage left-right workflow
- implement preview node editing
- implement publish result panel
- implement data management sections
- implement restore flow from subscription management to homepage

## 15. Acceptance Criteria

The first release of the new architecture is acceptable when all of the following are true:

- users can register and log in
- users can create and manage their own node-link datasets
- users can create and manage their own preferred-address datasets
- users can generate preview nodes from selected or pasted input
- users can remove preview nodes before publishing
- users can publish exactly one target-specific subscription link at a time
- users can set an expiration time on each published subscription
- public subscription links can be accessed without login until expiration
- users can view saved subscriptions, inspect details, delete them, and restore their saved input state
- one user's data is not visible or accessible to another user

## 16. Open Design Decisions Explicitly Deferred

The following topics are intentionally out of scope for this design and should be handled by future specs if needed:

- IP optimization history
- automatic probing and scheduling
- subscription analytics
- email verification
- password reset
- per-user quotas
- moderation and admin tooling
