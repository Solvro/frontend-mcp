# CLAUDE.md

## Projekt

`ml-mcp-frontend` — frontend chatbota odpowiadającego na pytania związane ze studiami
(Politechnika Wrocławska). Backend: MCP + warstwa ML (osobne repo, `../`).
Organizacja: **Solvro** (koło naukowe PWR).

**Aktualny etap:** design z Figmy zaimplementowany w Next.js i podłączony do backendu
(`backend-mcp`) przez BFF: czat, logowanie/rejestracja, historia rozmów z usuwaniem.
Uruchomienie i architektura dla ludzi: `README.md`.

## Stack i komendy

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · CSS Modules.
**Bez Tailwinda** — scena okienka to precyzyjna grafika wektorowa, więc kolory idą
przez zmienne CSS w `app/globals.css` (1:1 z kolekcją `Theme` w Figmie), a układ
przez CSS Modules.

```bash
npm run dev     # http://localhost:3000
npm run build
npx eslint app components lib
npx tsc --noEmit
```

## Struktura

- `app/globals.css` — tokeny (light + dark) i reset. Motyw: `data-theme` na `<html>`,
  domyślnie `prefers-color-scheme`; skrypt w `app/layout.tsx` ustawia go przed pierwszym malowaniem
- `components/Scene.tsx` + `RoomArt.tsx` — scenografia okienka; wnętrze i szyba to dwa
  nakładane `<svg viewBox="0 0 656 328">`, układ segregatorów generowany deterministycznie
  (ten sam LCG co w Figmie), żeby SSR i klient dały identyczny markup
- `components/Composer.tsx` — pole pytania: auto-grow, Enter wysyła, Shift+Enter nowa linia,
  załączniki z drag&drop i usuwaniem
- `components/Sidebar.tsx` — historia rozmów (z backendu przez `lib/useConversations.ts`),
  wyszukiwarka, zamykany popup logowania; poniżej 1024 px zmienia się w szufladę
- `lib/useDictation.ts` — dyktowanie przez Web Speech API (`pl-PL`); bez API mikrofon jest ukryty

## Zasoby w repo

- `public/brand/logo_pwr.png` — logo Politechniki Wrocławskiej (czerwień `#A5140F`, kremowy `#F5CFA0`)
- `public/brand/38877128.jpeg` — logo Solvro (granat `#1B2E4F`, błękit `#7BA7E8`)
- `public/brand/solvro-mark.png` — sam znak Solvro z przezroczystym tłem (do stopki)

## Design — wymagania produktowe

Strona tytułowa (landing / pusty stan czatu):

- marka w lewym górnym rogu: **Graf Wiedzy** (nie „Solvro") ze znakiem grafu
- pole tekstowe do zadania pytania (główny element, na 1. planie)
- załączanie plików (przycisk / dropzone przy polu tekstowym)
- wiadomość powitalna nad polem tekstowym
- ikona mowy (voice input) w **prawym górnym rogu**
- przycisk logowania
- historia rozmów (sidebar lub panel)
- popup w lewym dolnym rogu: przycisk **Zaloguj się** + krzyżyk zamykający
- stopka: `Made with ❤️ by Solvro © 2026`
- **motyw jasny i ciemny** — oba warianty muszą istnieć jako osobne ekrany

## Kierunek wizualny — obowiązkowy

Motyw przewodni: **okienko portierni / dziekanatu**. Wrażenie głębi warstwowej:

1. **Tło (najdalej)** — wnętrze pomieszczenia: regały z segregatorami i dokumentami,
   lampa biurkowa rzucająca ciepłe światło, ściana, drobne rekwizyty biurowe.
2. **Środek** — rama okienka podawczego: framuga, parapet, szyba z odblaskiem,
   tabliczka („Dziekanat" / godziny przyjęć).
3. **Pierwszy plan** — UI czatu: pole pytania, chipy z podpowiedziami, akcje.

Wszystko rysowane **wektorowo w Figmie** (kształty, gradienty, blur), nie zdjęcia stockowe.

## Antywymagania

- ma **nie** wyglądać jak „AI slop": brak generycznego fioletowo-niebieskiego gradientu,
  brak wycentrowanego pola na pustym tle, brak glassmorphism bez powodu,
  brak emoji-ikon zamiast prawdziwych ikon
- brak lorem ipsum — teksty po polsku, realistyczne pytania studenckie
- kolorystyka: własna, spójna z Solvro/PWR — nie kopiować palety ChatGPT/Claude

## Praca z Figmą

Plik: `https://www.figma.com/design/uTohfHY5Qrucn3sEt3Fyia` (strona `Landing`).
Figma jest źródłem prawdy dla wyglądu — zmiany wizualne nanoś w obu miejscach.

- MCP: `plugin:figma:figma`, plan `team::1653816972955211923` (konto `fidok`)
- **Zawsze** ładuj skill `figma-use` przed `use_figma` i `figma-create-new-file`
  przed `create_new_file` — to twardy wymóg tych narzędzi
- Buduj przyrostowo: sekcja po sekcji, po każdej `get_screenshot` i ocena wizualna
- Zmienne Figmy dla kolorów z trybami `Light`/`Dark` — nie hardkoduj wartości
- Nazewnictwo warstw po angielsku, teksty w UI po polsku
- Po każdej większej zmianie pokaż użytkownikowi screenshot przed pytaniem o dalsze kroki

## Integracja z backendem (plan z 2026-09-18, zrealizowany)

Plan krok po kroku: `docs/superpowers/plans/2026-09-18-frontend-backend-integration.md`.

- Backend: `../backend-mcp` — `chat-service` (:8001, `/api/chat`, `/api/sessions/*`,
  `/api/users/me/sessions`) i `auth-service` (:8000, `/auth/*`, JWT RS256 + rotowany refresh token).
  Start: `cd ../ml-mcp && just up-dev`, potem `cd ../backend-mcp && just up`.
- Architektura: przeglądarka woła tylko `/bff/*` (route handlery Next) → brak CORS i self-signed TLS;
  tokeny w ciasteczkach `httpOnly` (`gw_access`, `gw_refresh`, `gw_email`, `gw_name`, path `/bff`), auto-refresh w BFF.
  Env: `CHAT_SERVICE_URL`, `AUTH_SERVICE_URL`, `BFF_TRUST_PROXY` (`.env.example`).
  Równoległe refreshe dzielą jedną rotację (`lib/server/backend.ts`) — backend unieważnia
  całą rodzinę tokenów przy ponownym użyciu starego refresh tokenu.
- Braki backendu (frontend je obchodzi / ukrywa): brak uploadu plików (spinacz ukryty), brak streamingu,
  brak tytułu rozmowy (wysyłamy `metadata.title`), brak źródeł w odpowiedzi,
  `docker/compose.yml` nie przekazuje kluczy LLM do chat-service, anonimowa rozmowa nie przechodzi
  na konto po zalogowaniu (jej sesje mają `user_id: null` i nie wchodzą do historii),
  rate limit per IP za BFF wymaga `BFF_TRUST_PROXY=1` i IP serwera Next w `FORWARDED_ALLOW_IPS`.
- Daty z backendu to UTC bez strefy — parsuj przez `parseBackendDate` (dokleja `Z`).

## Git

- **Nie rób commitów** (ani `git add`/`push`) bez wyraźnej prośby użytkownika — zmiany zostają
  w working tree do jego przeglądu. Dotyczy też kroków „Commit” w planach — pomijaj je.

## Komunikacja

Użytkownik pisze po polsku — odpowiadaj po polsku. Teksty w designie po polsku.
