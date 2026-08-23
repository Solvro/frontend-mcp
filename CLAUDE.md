# CLAUDE.md

## Projekt

`ml-mcp-frontend` — frontend chatbota odpowiadającego na pytania związane ze studiami
(Politechnika Wrocławska). Backend: MCP + warstwa ML (osobne repo, `../`).
Organizacja: **Solvro** (koło naukowe PWR).

**Aktualny etap:** design w Figmie jest zaimplementowany jako strona w Next.js.
Backendu (API asystenta, logowanie) jeszcze nie ma — miejsca styku oznaczone `TODO`
w `components/Landing.tsx` i `lib/data.ts`.

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
- `components/Sidebar.tsx` — historia rozmów, wyszukiwarka, zamykany popup logowania;
  poniżej 1024 px zmienia się w szufladę
- `lib/useDictation.ts` — dyktowanie przez Web Speech API (`pl-PL`), z cichym fallbackiem

## Zasoby w repo

- `public/brand/logo_pwr.png` — logo Politechniki Wrocławskiej (czerwień `#A5140F`, kremowy `#F5CFA0`)
- `public/brand/38877128.jpeg` — logo Solvro (granat `#1B2E4F`, błękit `#7BA7E8`)

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

## Komunikacja

Użytkownik pisze po polsku — odpowiadaj po polsku. Teksty w designie po polsku.
