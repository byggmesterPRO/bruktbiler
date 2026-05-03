# Bruktbiler — LB Phone App Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan. Steps use `- [ ]` checkboxes for tracking.

**Goal:** A premium FiveM `lb-phone` app for a used-car business. Players browse cars, register interest, and bid in auctions; the dealership also sells **on behalf of private sellers** (consignment — either physically in the shop, or remotely with the seller keeping the car); private players can also **list their own cars for sale**. Complete admin panel. Auth uses phone number ("tlfnr") + password; admins can reset passwords.

**Architecture:** Adapted from `lb-phone-app-template/lb-reactts`. Three layers:
- **Server (Lua, oxmysql):** DB persistence, auth (sha256+salt), business logic. All write ops gated by session token.
- **Client (Lua):** Registers app via `lb-phone:AddCustomApp`. Bridges NUI ↔ server using `RegisterNUICallback` + `lib.callback` (ox_lib).
- **UI (React + TS + Vite):** SPA with view router (login → home → car list → car detail → auctions → admin). Talks to client via `fetchNui`.

**Tech Stack:** FiveM `cerulean`, lb-phone, oxmysql, ox_lib, React 18 + TypeScript, Vite 4.

**Database:** MySQL — tables: `bb_users`, `bb_cars`, `bb_interests`, `bb_auctions`, `bb_bids`, `bb_sessions`.

---

## Chunk 1: Bootstrap & DB schema

### Task 1: Copy `lb-reactts` to repo root, rename, configure

**Files:**
- Create: `fxmanifest.lua`, `config.lua`, `client/client.lua`, `client/functions.lua`, `server/`, `ui/*` (copied/adapted)

- [ ] Copy `template/lb-reactts/{client,ui,config.lua,fxmanifest.lua}` to repo root
- [ ] Edit `config.lua`: `Config.Identifier = "bruktbiler"`, name "Bruktbiler", developer "Einar", `DefaultApp = false`
- [ ] Edit `fxmanifest.lua`: title/description Norwegian; declare deps `oxmysql`, `ox_lib`; add `server_scripts` glob; add `dependency 'lb-phone'`
- [ ] Edit `ui/package.json`: name `bruktbiler-ui`
- [ ] Add `ui/dist/` to top-level `.gitignore`; keep `ui/dist/**/*` in fxmanifest `file` list

### Task 2: DB schema & install script

**Files:**
- Create: `server/db.lua` (table create-if-not-exists at resource start)

- [ ] Define tables:
  - `bb_users(id PK, tlfnr UNIQUE, password_hash, salt, is_admin, created_at)`
  - `bb_cars(id PK, make, model, year, price, mileage, image, description, status ENUM('available','sold','auction','pending'), listing_type ENUM('dealership','consignment_in_shop','consignment_remote','private'), seller_user_id FK NULL, commission_pct, approved BOOL, created_at)`
    - `dealership` = shop owns the car
    - `consignment_in_shop` = private seller, car is at the dealership
    - `consignment_remote` = private seller keeps car; dealership lists it
    - `private` = pure peer-to-peer listing (no dealership involvement)
    - `approved` = admin must approve non-dealership listings before they go live
    - `pending` status = waiting for admin approval
  - `bb_interests(id PK, user_id FK, car_id FK, message, created_at, UNIQUE(user_id,car_id))`
  - `bb_auctions(id PK, car_id FK, start_price, current_bid, current_bidder_id, ends_at, status ENUM('active','ended'), created_at)`
  - `bb_bids(id PK, auction_id FK, user_id FK, amount, created_at)`
  - `bb_sessions(token PK, user_id FK, expires_at)`
- [ ] Run schema on `onResourceStart` via `MySQL.query`

### Task 3: Seed default admin

- [ ] On first run, if no admin exists insert one with tlfnr=`00000000`, password=`admin` (hashed). Print warning to console.

---

## Chunk 2: Auth & server callbacks

### Task 4: Password hashing util

**Files:** `server/auth.lua`

- [ ] `HashPassword(password, salt)` → sha256(salt..password) using `lib.crypto` from ox_lib (or a small inline sha256 if unavailable)
- [ ] `GenerateSalt()` — 16 bytes hex via `math.random` seeded with `os.time()`
- [ ] `GenerateToken()` — 32 bytes hex
- [ ] `VerifyPassword(plain, hash, salt)` — constant-time compare

### Task 5: Auth callbacks

**Files:** `server/callbacks.lua`

Register via `lib.callback.register`:
- [ ] `bruktbiler:register({ tlfnr, password })` → insert user, return `{ token, isAdmin }`. Reject if tlfnr exists.
- [ ] `bruktbiler:login({ tlfnr, password })` → verify, create session row, return `{ token, isAdmin }`.
- [ ] `bruktbiler:logout({ token })` → delete session row.
- [ ] Helper `RequireAuth(token)` returns `(userRow|nil, errMsg)`. Used by every protected callback. Sessions expire after 7 days.

### Task 6: Cars callbacks

- [ ] `bruktbiler:listCars({ token })` → all cars with status `available` or `auction`.
- [ ] `bruktbiler:getCar({ token, id })` → full car + (if auction) auction + top 5 bids.
- [ ] `bruktbiler:expressInterest({ token, carId, message })` → upsert interest row.
- [ ] `bruktbiler:listMyInterests({ token })` → user's interests joined with car.
- [ ] `bruktbiler:submitListing({ token, listingType, ...car fields })` → user-submitted car. listingType ∈ `consignment_in_shop|consignment_remote|private`. Insert with `status='pending'`, `approved=false`, `seller_user_id=user.id`.
- [ ] `bruktbiler:listMyListings({ token })` → cars where `seller_user_id = me`.
- [ ] `bruktbiler:withdrawListing({ token, carId })` → only own + status not sold.

### Task 7: Auction callbacks

- [ ] `bruktbiler:placeBid({ token, auctionId, amount })` → validate `amount > current_bid`, insert bid, update auction row.
- [ ] Background task: every 30s, mark auctions whose `ends_at < NOW()` as `ended` and corresponding car as `sold`.

### Task 8: Admin callbacks (extra `RequireAdmin` check)

- [ ] `bruktbiler:adminListUsers`
- [ ] `bruktbiler:adminResetPassword({ targetUserId, newPassword })`
- [ ] `bruktbiler:adminCreateCar({...car fields})`
- [ ] `bruktbiler:adminUpdateCar`
- [ ] `bruktbiler:adminDeleteCar`
- [ ] `bruktbiler:adminListInterests` (joined with user + car)
- [ ] `bruktbiler:adminCreateAuction({ carId, startPrice, durationHours })`
- [ ] `bruktbiler:adminEndAuction({ auctionId })`
- [ ] `bruktbiler:adminListPendingListings` → cars with `approved=false`
- [ ] `bruktbiler:adminApproveListing({ carId, commissionPct })` → set `approved=true`, `status='available'`
- [ ] `bruktbiler:adminRejectListing({ carId, reason })` → delete + log

---

## Chunk 3: Client bridge

### Task 9: Strip template demo from client.lua, keep AddApp

- [ ] Remove direction/yaw loop, `getDirection`, `toggleCamera`, `drawNotification` callbacks
- [ ] Keep `AddApp` block. Update icon path comments.

### Task 10: Generic NUI→server bridge

**Files:** `client/bridge.lua`

- [ ] One NUI callback `bruktbiler:call` that takes `{ event, data }` and forwards to server via `lib.callback.await('bruktbiler:'..event, false, data)`. Returns server response to UI.
- [ ] Avoids registering one NUI callback per server event.

---

## Chunk 4: UI

### Task 11: Strip template UI

**Files:** rewrite `ui/src/App.tsx`, keep `Frame.tsx`, `colors.css`, base index files.

- [ ] Remove demo buttons. App becomes a router by `view` state: `'login' | 'register' | 'home' | 'cars' | 'car' | 'auctions' | 'myInterests' | 'admin'`.
- [ ] Auth context: token + isAdmin in `useState`, persisted to `localStorage` (mock-only) or kept in memory in NUI. Use memory + revalidate-on-mount.

### Task 12: API helper

**Files:** `ui/src/api.ts`

- [ ] `api(event, data)` — wraps `fetchNui('bruktbiler:call', { event, data })`. In devMode returns `mockData` from a local store so `npm run dev` still renders.

### Task 13: Login + Register screens

**Files:** `ui/src/views/Auth.tsx`, `ui/src/views/Auth.css`

- [ ] Form with `tlfnr` (numeric) + `password`. Toggle between login/register. Calls `api('login'|'register', ...)`. On success store token, route to `home`.

### Task 14: Home / Cars list

**Files:** `ui/src/views/Cars.tsx`

- [ ] Grid of cars (image, make/model, year, price). Tap → `car` view.
- [ ] Bottom nav: Biler / Auksjoner / Mine / (Admin if admin).

### Task 15: Car detail + interest

**Files:** `ui/src/views/CarDetail.tsx`

- [ ] Image, full description, "Vis interesse" button → opens `setPopUp` with text input → calls `expressInterest`.
- [ ] If car is on auction, render auction widget (current bid, time left, "By på bil" button → bid input popup).

### Task 16: My interests

**Files:** `ui/src/views/MyInterests.tsx`

- [ ] List of interests with car preview + message + timestamp.

### Task 17: Auctions list

**Files:** `ui/src/views/Auctions.tsx`

- [ ] All cars with status `auction`. Live countdown via `setInterval`.

### Task 18: Admin panel

**Files:** `ui/src/views/admin/Admin.tsx`, sub-views:
- `admin/Users.tsx` (list, reset password)
- `admin/Cars.tsx` (CRUD form)
- `admin/Interests.tsx` (read-only list)
- `admin/Auctions.tsx` (create from car, end early)

- [ ] Tabbed interface (top tabs).

### Task 18b: Sell-your-car flow

**Files:** `ui/src/views/SellCar.tsx`

- [ ] Multi-step form: choose listing type (`Konsignasjon hos forhandler` / `Privat med visning hos meg` / `Privat salg`), enter make/model/year/mileage/price/image URL/description, submit.
- [ ] After submit: shown in "Mine annonser" with status `Venter på godkjenning`.

### Task 19: Premium styling

- [ ] `ui/src/theme.css`: dark gradient background, glass-morphism cards (backdrop-filter blur), gold accent `#d4af37`, serif display font for headlines (Playfair Display or system fallback), Inter for body.
- [ ] Smooth view transitions (CSS `@keyframes` fade + slide).
- [ ] High-quality default placeholder image. Card hover lift.
- [ ] All text in Norwegian (bokmål).

---

## Chunk 5: Build, repo, polish

### Task 20: Build the UI

- [ ] `cd ui && npm install && npm run build`. Confirm `ui/dist/index.html` and assets exist.
- [ ] Switch `fxmanifest.lua` ui_page to `ui/dist/index.html` (commented dev URL preserved).

### Task 21: README

**Files:** `README.md`

- [ ] Norwegian readme: install steps (oxmysql, ox_lib, lb-phone deps), config, default admin creds, dev workflow.

### Task 22: Git + GitHub

- [ ] `git init`, add files, commit
- [ ] Create GitHub repo via `gh repo create einarkholt/bruktbiler --public --source . --push` (or per user's gh login)

---

## Open decisions deferred to execution

1. **Auction polling** — chose 30s server-side cron (simple). Alternative: per-call lazy expiration.
2. **Password hashing** — using sha256+salt (no native bcrypt in FiveM). Acceptable for game server context; documented in README.
3. **Admin bootstrapping** — default admin `00000000` / `admin`, must be changed on first login.
