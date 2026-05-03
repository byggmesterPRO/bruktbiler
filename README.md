# Bruktbiler — LB Phone App

En premium bruktbiler-app for [LB Phone](https://docs.lbscripts.com/lb-phone) som fungerer som en komplett bedrift for kjøp, salg, konsignasjon og auksjon av biler.

## Funksjoner

- **Brukere registrerer seg med tlfnr + passord** (passord hashes med SHA-256 + tilfeldig salt)
- **Forhandler-biler** — admin legger inn biler dealershipet eier
- **Konsignasjon** — privatpersoner kan levere bilen til forhandler eller selge mens de selv har den
- **Privat salg** — brukere kan legge ut sine egne biler
- **Vis interesse** — brukere kan registrere interesse for en bil med en melding
- **Auksjon** — admin kan legge en bil på auksjon med startpris og varighet; auksjoner avsluttes automatisk
- **Komplett admin-panel:**
  - Se / godkjenn / avvis ventende annonser
  - CRUD på alle biler
  - Se alle interesser
  - Start / avslutt auksjoner
  - Tilbakestille passord til brukere
  - Gjøre brukere til admin

## Avhengigheter

- [lb-phone](https://docs.lbscripts.com/lb-phone)
- [oxmysql](https://github.com/overextended/oxmysql)
- [ox_lib](https://github.com/overextended/ox_lib)

## Installasjon

1. Klon eller last ned ressursen til `resources/[bruktbiler]/bruktbiler/` på FiveM-serveren din.
2. Sørg for at avhengighetene over er startet før denne ressursen.
3. Kjør UI-build én gang:
   ```bash
   cd ui
   npm install
   npm run build
   ```
4. Legg `ensure bruktbiler` i `server.cfg`.
5. Start serveren. Databasetabellene opprettes automatisk første gang.

### Default admin

Første gang ressursen starter opprettes en default admin-bruker:

| Tlfnr | Passord |
|---|---|
| `00000000` | `admin` |

**Logg inn og bytt passordet med en gang!** (eller fjern brukeren via admin-panelet etter at du har laget din egen).

## Utvikling

UI-en bruker Vite + React + TypeScript:

```bash
cd ui
npm run dev
```

Endre `fxmanifest.lua` til å peke `ui_page` mot `http://localhost:3000/` for live-reload mens du jobber.

```lua
-- ui_page "ui/dist/index.html"
ui_page "http://localhost:3000/"
```

Husk å bytte tilbake før du committer.

## Konfigurasjon

Se `config.lua`:

- `Config.SessionTTL` — sesjonens varighet (sekunder)
- `Config.DefaultAdmin` — default admin-bruker
- `Config.AuctionTickInterval` — hvor ofte serveren sjekker for utløpte auksjoner
- `Config.DefaultCommissionPct` — default provisjon på godkjente konsignasjoner

## Database-skjema

Se `server/db.lua`. Tabeller:

- `bb_users` — brukere
- `bb_sessions` — auth-tokens
- `bb_cars` — alle biler (status: `available`, `sold`, `auction`, `pending`, `withdrawn`; listing_type: `dealership`, `consignment_in_shop`, `consignment_remote`, `private`)
- `bb_interests` — interessemeldinger
- `bb_auctions` — auksjoner
- `bb_bids` — bud

## Sikkerhet

Passord hashes med SHA-256 + 16 byte tilfeldig salt. Dette er tilstrekkelig for FiveM-kontekst der serveren er trust-boundary, men ikke "bank-grade". Bytt til argon2/bcrypt via et binært modul dersom du eksponerer tjenesten utenfor spillet.

Alle skrive-callbacks krever en gyldig session-token. Admin-callbacks gjør i tillegg `is_admin = 1`-sjekk.

## Lisens

MIT
