# Graf Wiedzy — frontend

Frontend asystenta studenta Politechniki Wrocławskiej: czat, który odpowiada na pytania
o regulaminy, terminy, zapisy i stypendia na podstawie grafu wiedzy. Projekt koła naukowego
[Solvro](https://github.com/Solvro).

Next.js 16 (App Router) · React 19 · TypeScript · CSS Modules (bez Tailwinda) · Vitest.

## Uruchomienie

Wymagany Node 20.9+.

```bash
npm install
cp .env.example .env.local   # adresy serwisów backendu
npm run dev                  # http://localhost:3000
```

Bez działającego backendu strona się wczyta, ale pytania i logowanie zwrócą
„Serwer nie odpowiada”. Backend z repozytoriów obok:

```bash
cd ../ml-mcp && just up-dev      # MCP server + Neo4j (graf wiedzy)
cd ../backend-mcp && just up     # auth-service :8000, chat-service :8001
```

## Komendy

| Komenda | Co robi |
|---|---|
| `npm run dev` | serwer deweloperski (Turbopack) |
| `npm run build` / `npm start` | build produkcyjny i jego uruchomienie |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | sprawdzenie typów |
| `npm test` | testy Vitest (`lib/**`, `app/**`) |

## Architektura

Przeglądarka rozmawia wyłącznie z BFF — route handlerami Next w `app/bff/*` — a te
z serwisami `backend-mcp`. Dzięki temu nie ma CORS ani self-signed TLS po stronie
przeglądarki, a tokeny nigdy nie trafiają do JavaScriptu.

```
przeglądarka ──/bff/auth/*──▶ auth-service  (login, rejestracja, refresh, logout)
             ──/bff/chat/*──▶ chat-service  (pytania, historia rozmów)
```

- **Sesja**: JWT w ciasteczkach `httpOnly` (`gw_access`, `gw_refresh`, `gw_email`, `gw_name`,
  `path=/bff`). BFF sam odświeża wygasły access token. Równoległe żądania dzielą jedną
  rotację refresh tokenu, bo backend traktuje ponowne użycie tokenu jak kradzież.
- **Proxy czatu** przepuszcza tylko endpointy używane przez UI (allowlista w
  `app/bff/chat/[...path]/route.ts`).
- **Awaria backendu**: BFF odpowiada `502 {detail: "upstream_unavailable"}`, a UI
  pokazuje komunikat po polsku.
- **Limit pytań**: nagłówki `RateLimit-*` zamykają „okienko”, zanim kolejne pytanie
  dostanie 429 (`lib/quotaLock.ts`).

## Struktura

```
app/
  bff/            route handlery BFF (auth, chat) + ich testy
  layout.tsx      fonty, motyw ustawiany przed pierwszym malowaniem
lib/
  server/         kod tylko dla serwera: forward z refreshem, ciasteczka, IP klienta
  api/            klient /bff dla przeglądarki, mapowanie błędów RFC 7807 na komunikaty
  use*.ts(x)      hooki: sesja, czat, historia rozmów, dyktowanie
components/       UI: scena okienka (Scene, RoomArt), Composer, Sidebar, AuthOverlay…
```

## Zmienne środowiskowe

| Zmienna | Opis |
|---|---|
| `AUTH_SERVICE_URL` | adres auth-service widziany z serwera Next, np. `http://localhost:8000` |
| `CHAT_SERVICE_URL` | adres chat-service, np. `http://localhost:8001` |
| `BFF_TRUST_PROXY` | `1` tylko wtedy, gdy przed Next stoi proxy dopisujące adres do `X-Forwarded-For` |

## Wdrożenie

- Nagłówki bezpieczeństwa (CSP, HSTS w prod, `Referrer-Policy`, `Permissions-Policy`)
  ustawia `next.config.ts`.
- Backend liczy limity per IP klienta. Za reverse proxy ustaw `BFF_TRUST_PROXY=1`
  i dopisz adres serwera Next do `FORWARDED_ALLOW_IPS` w auth-service i chat-service.
  Bez tego wszyscy niezalogowani dzielą jeden limit.
- BFF trzyma pamięć rotacji tokenów w procesie. Przy kilku instancjach potrzebna
  jest wspólna blokada (np. Redis).

## Design

Motyw „okienka dziekanatu” jest zaprojektowany w Figmie i przeniesiony 1:1:
kolory to zmienne CSS w `app/globals.css` (motyw jasny i ciemny), a scena to wektorowe SVG.
Szczegóły w [`DESIGN.md`](DESIGN.md).
