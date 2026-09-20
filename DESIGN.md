# DESIGN.md — Graf Wiedzy

Opis obecnego designu strony (stan na 2026-09-18). Źródło prawdy dla wyglądu to Figma —
plik `uTohfHY5Qrucn3sEt3Fyia`, strona `Landing`, ramki `Landing / Light` (`3:2`) i
`Landing / Dark` (`3:83`), 1440 × 1024. Tokeny z `app/globals.css` są 1:1 z kolekcją `Theme`
w Figmie. Zmiana wyglądu = zmiana w obu miejscach.

---

## 1. Koncept

**Okienko podawcze dziekanatu.** Student podchodzi do okienka i zadaje pytanie przez szybę.
Strona ma trzy warstwy głębi, od najdalszej:

| Warstwa | Co zawiera | Implementacja |
|---|---|---|
| 1. Wnętrze (tło) | ściana pokoju, regały z segregatorami, tablica ogłoszeń, lampa z ciepłym stożkiem światła, kubek, papiery | `components/RoomArt.tsx` → `RoomInterior`, lekki `blur(0.8px)` dla głębi |
| 2. Okienko (środek) | framuga, wnęka, szyba z refleksami, kratka do mówienia, karteczka na taśmie, parapet, tabliczka „DZIEKANAT · OKIENKO 1” | `Scene.tsx` + `RoomArt.tsx` → `GlassLayer` (tryb `screen`) |
| 3. UI (pierwszy plan) | pole pytania oparte o parapet, podpowiedzi, notka o źródłach | `Composer.tsx`, `Landing.tsx` |

Efekt głębi daje nachodzenie: karta pytania ma `margin-top: -58px` i zachodzi na parapet
(`.overlap`), a z okienka na ścianę bije ciepła poświata (`.glow`).

Scena jest rysowana **wektorowo** (dwa nałożone `<svg viewBox="0 0 656 328">`). Układ
segregatorów generuje deterministyczny LCG, ten sam co w Figmie, więc SSR i klient dają
identyczny markup. Żadnych zdjęć stockowych.

**Charakter:** ciepły, papierowo-drewniany, instytucjonalny, ale życzliwy. Jasny motyw jest
kremowo-beżowy, ciemny to granatowy pokój po godzinach z żółtym światłem lampy.

---

## 2. Kolory

Wszystkie kolory idą przez zmienne CSS. **Nie hardkodujemy wartości w komponentach.**
Motyw: `data-theme="light" | "dark"` na `<html>`, a domyślnie `prefers-color-scheme`.
Skrypt w `app/layout.tsx` ustawia motyw przed pierwszym malowaniem (klucz `localStorage`
`gw-theme`).

### 2.1 UI

| Token | Light | Dark | Użycie |
|---|---|---|---|
| `--bg-page` | `#f2ece2` | `#0e131e` | tło strony, topbar |
| `--wall-top` | `#efe7da` | `#151c2b` | gradient ściany — góra |
| `--wall-bottom` | `#e1d5c2` | `#0a0e17` | gradient ściany — dół |
| `--surface-card` | `#ffffff` | `#1a2231` | karta pytania, chipy, przycisk logowania |
| `--surface-sidebar` | `#eae2d5` | `#111827` | sidebar |
| `--surface-raised` | `#f7f2ea` | `#232c3d` | pigułka statusu, aktywny element historii, karta logowania |
| `--surface-sunken` | `#e5dbca` | `#0d121c` | wyszukiwarka, przyciski ikon w composerze, chipy załączników |
| `--border-subtle` | `#d8ccb8` | `#2a3446` | domyślna ramka 1px |
| `--border-strong` | `#bfb199` | `#3a465c` | ramki przycisków drugorzędnych |
| `--text-primary` | `#1c2430` | `#ece6dc` | nagłówki, treść |
| `--text-secondary` | `#6a6151` | `#9ba5b5` | podtytuły, elementy historii |
| `--text-muted` | `#968b78` | `#6b7686` | etykiety, podpowiedzi, stopka |
| `--text-inverse` | `#ffffff` | `#0e131e` | tekst na akcencie |

### 2.2 Akcenty

| Token | Light | Dark | Rola |
|---|---|---|---|
| `--accent-brand` | `#1b2e4f` | `#7ba7e8` | granat Solvro / błękit Solvro — „Nowa rozmowa”, znak marki, dymek użytkownika |
| `--accent-blue` | `#2f62b8` | `#6f9fe8` | akcja główna (wyślij), linki, fokus, kursor |
| `--accent-blue-soft` | `#dce7f8` | `#1e2c46` | tło komunikatów informacyjnych |
| `--accent-amber` | `#c77f26` | `#f0b45c` | ikona zegara w pigułce „Okienko czynne 24/7” |
| `--accent-red` | `#a5140f` | `#d9463f` | czerwień PWR — serce w stopce, PDF, dyktowanie, błędy |

Paleta wynika z marek: **PWR** (czerwień `#A5140F`, kremowy `#F5CFA0`) i **Solvro**
(granat `#1B2E4F`, błękit `#7BA7E8`). Mieszanie przez `color-mix(in srgb, …)` jest
dozwolone i stosowane, np. do hoverów, tła błędu i zaznaczenia.

### 2.3 Scenografia

| Token | Light | Dark | Element |
|---|---|---|---|
| `--casing` / `-lit` / `-shade` | `#c4b195` / `#dccdb4` / `#9a876b` | `#28324a` / `#39465f` / `#1a2233` | framuga okienka |
| `--sill` / `--sill-face` | `#d3c2a6` / `#b3a184` | `#303b52` / `#212b3e` | parapet |
| `--room-wall` / `-dark` | `#4a3f2e` / `#33291b` | `#1c2434` / `#121a28` | ściana pokoju |
| `--room-shelf` / `-dark` | `#6b5a40` / `#4a3d28` | `#33405a` / `#232e42` | regały |
| `--room-counter` / `-top` | `#5a4a32` / `#7a6746` | `#26304a` / `#3a4763` | lada |
| `--room-board` | `#3e3222` | `#1b2434` | tablica ogłoszeń |
| `--room-paper` | `#e8dfc8` | `#c9cfd9` | kartki, papiery |
| `--lamp` / `--lamp-lit` | `#c9873a` / `#f2ce8e` | `#8a6a3a` / `#f0c888` | lampa, żarówka |
| `--glow` + `--glow-strength` | `#f5c066`, `0.2` | `#f0b45c`, `0.16` | poświata na ścianie |
| `--sheen` + `--sheen-strength` | `#ffffff`, `0.06` | `#bbd3f5`, `0.045` | refleksy na szybie (przejrzysta szyba) |
| `--lamp-on` | `0` | `1` | lampka: w dzień zgaszona, wieczorem świeci; mnoży też poświatę `.glow` |
| `--coffee` | `#4a2e1a` | `#2e1d12` | kawa w kubku na ladzie |
| `--note` | `#e9d48a` | `#c9a94e` | karteczka na szybie |
| `--bind-0` … `--bind-9` | 10 odcieni (terakota, oliwka, granat, zieleń, beż, bordo, stal…) | przygaszone odpowiedniki | grzbiety segregatorów |

### 2.4 Cienie

Siłę cienia sterują dwa tokeny alfa, bo w ciemnym motywie cienie muszą być dużo mocniejsze:

| Token | Light | Dark |
|---|---|---|
| `--shadow-a` | `0.16` | `0.55` |
| `--scene-shadow-a` | `0.18` | `0.5` |

Wzorce:
- karta pytania: `0 24px 56px -12px rgba(0,0,0,var(--shadow-a)), 0 4px 10px -4px rgba(0,0,0,calc(var(--shadow-a)*0.8))`
- okienko: `0 18px 44px -10px rgba(0,0,0,var(--scene-shadow-a))`
- chip podpowiedzi: `0 2px 6px -1px rgba(0,0,0,calc(var(--shadow-a)*0.5))`
- przycisk wyślij: `0 6px 14px -2px color-mix(in srgb, var(--accent-blue) 45%, transparent)`
- wnętrze pokoju: `inset 0 8px 28px 2px rgba(0,0,0,0.6)`

---

## 3. Typografia

Fonty z `next/font/google` (`app/layout.tsx`), subsety `latin` + `latin-ext` (polskie znaki):

| Zmienna | Krój | Rola |
|---|---|---|
| `--font-sans` | **Inter** | cały interfejs |
| `--font-display` | **Fraunces** | nagłówek powitalny, tytuły dialogów |
| `--font-mono` | **JetBrains Mono** | etykiety: eyebrow, tabliczka, nagłówki grup historii, autor wiadomości |

Bazowo: `14px / 1.45`, antialiasing włączony.

| Element | Krój | Rozmiar | Waga | Inne |
|---|---|---|---|---|
| Nagłówek „Dzień dobry. Czym mogę służyć?” | Fraunces | `clamp(28px, 4.2vw, 42px)` | 600 | `line-height 1.16`, `letter-spacing -0.01em`, `text-wrap: balance` |
| Podtytuł | Inter | 15px | 400 | `line-height 1.5`, `--text-secondary`, max 780px |
| Eyebrow „ASYSTENT STUDENTA · …” | JetBrains Mono | 10px | 400 | `uppercase`, `letter-spacing 0.2em`, `--text-muted` |
| Tabliczka „DZIEKANAT · OKIENKO 1” | JetBrains Mono | 10px (9px mobile) | 400 | `letter-spacing 0.16em` |
| Nazwa marki „Graf Wiedzy” | Inter | 15px | 600 | |
| Podpis marki „Asystent studenta” | Inter | 11px | 400 | `--text-muted` |
| Etykieta grupy historii („DZISIAJ”) | JetBrains Mono | 9.5px | 400 | `uppercase`, `letter-spacing 0.12em` |
| Element historii | Inter | 12.5px | 400 (aktywny 500) | ellipsis |
| Pole pytania | Inter | 16px | 400 | `line-height 1.4`, kursor `--accent-blue` |
| Podpowiedź w composerze | Inter | 11.5px | 400 | `--text-muted` |
| Chip podpowiedzi | Inter | 12.5px | 500 | |
| Przyciski (topbar, sidebar) | Inter | 13–13.5px | 500 | |
| Notka o źródłach, stopka | Inter | 12px | 400 | `--text-muted` |
| Wiadomość w rozmowie | Inter | 14.5px | 400 | `line-height 1.55`, `pre-wrap` |

---

## 4. Layout

### 4.1 Szkielet (desktop, 1440 × 1024)

```
┌──────────────┬─────────────────────────────────────────────────────┐
│ Sidebar 288  │ Topbar 68px (pigułka · … · motyw · Zaloguj się)     │
│              ├─────────────────────────────────────────────────────┤
│ marka        │            eyebrow                                  │
│ Nowa rozmowa │   Dzień dobry. Czym mogę służyć?                    │
│ szukaj       │            podtytuł                                 │
│ historia     │          ┌─[ DZIEKANAT · OKIENKO 1 ]─┐              │
│  (grupy)     │          │   okienko 700 × 372       │              │
│              │      ════╧══ parapet 820 ══════════╧════            │
│              │          ┌── composer 600 ──────────┐ ← zachodzi    │
│              │          └──────────────────────────┘   -58px       │
│              │        [chip] [chip] [chip] [chip]                  │
│ karta        │        notka o źródłach                             │
│ logowania    │                                                     │
│              │        Made with ♥ by KN Solvro © 2026              │
└──────────────┴─────────────────────────────────────────────────────┘
```

- `.shell` to flex: sidebar `--sidebar-w: 288px` + główna kolumna. Cały ekran ma `100dvh`,
  przewija się tylko `.scroll` w kolumnie głównej.
- Scena (`.stage`) ma padding `22px 24px 28px`, a treść jest wyśrodkowana w kolumnie.
- Szerokości: okienko `min(700px, 100%)` o proporcji `700/372`, parapet `min(820px, 100%)`,
  composer `min(600px, 100%)`, wątek rozmowy `min(760px, 100%)`, podtytuł max 780px.
- Stopka jest dociśnięta do dołu (`margin-top: auto`).

### 4.2 Breakpointy

| Szerokość | Zmiany |
|---|---|
| `≤ 1024px` | sidebar staje się szufladą (`position: fixed`, `translateX(-100%)`, animacja 0.22s, scrim `rgba(0,0,0,.42)`); w topbarze pojawia się hamburger |
| `≤ 720px` | topbar: padding 14px, pigułka ukryta, przycisk logowania bez tekstu; scena: padding `18px 14px 24px`; parapet 22px; overlap `-40px`; composer: padding 14px, ukryta podpowiedź |

### 4.3 Odstępy i promienie

Spacing jest „na oko” w pikselach, bez skali tokenów. Najczęstsze wartości: 4, 8, 10, 12, 14,
16, 18, 20, 22, 24, 28.

| Promień | Gdzie |
|---|---|
| `18px` (`--radius-card`) | karta pytania, dialogi |
| `14px` | karta logowania, dymki wiadomości |
| `11px` | przyciski topbaru, „Nowa rozmowa” |
| `10px` | elementy historii, wyszukiwarka, przyciski ikon w composerze |
| `8–9px` | chipy załączników, okienko, znak marki |
| `999px` | przycisk wyślij, chipy podpowiedzi, pigułka (`17px`) |

Ramki mają zawsze `1px solid`, domyślnie `--border-subtle`.

---

## 5. Komponenty

### Sidebar (`Sidebar.tsx`)
- Tło `--surface-sidebar`, prawa ramka `--border-subtle`, padding `22px 20px 20px`.
- **Marka:** kwadrat 32px, `radius 9px`, tło `--accent-brand`, znak grafu (`GraphMark`) + dwie linie tekstu. Całość to link `/`: kliknięcie wraca na stronę główną (to samo co „Nowa rozmowa”, z przejściem), hover rozjaśnia znak.
- **„Nowa rozmowa”:** 42px wysokości, pełna szerokość, `--accent-brand`, tekst `--text-inverse`; hover `brightness(1.08)`, active `translateY(1px)`.
- **Szukaj:** 36px, `--surface-sunken`. Widoczne tylko, gdy jest jakakolwiek historia.
- **Historia:** grupy „Dziś / Wczoraj / Ostatnie 7 dni / Starsze” (w Figmie: Dzisiaj / 7 dni temu / Wcześniej). Element ma 36px, ikonę dymka i ellipsis. Aktywny: `--surface-raised` + ramka, ikona w `--accent-brand`.
- **Pusty stan:** ikona w kwadracie 38px, „Brak rozmów” i jedno zdanie zachęty.
- **Karta logowania** (lewy dół): `--surface-raised`, `radius 14px`, tekst 12px, przycisk z obrysem `--border-strong` i tekstem `--accent-blue`, krzyżyk w prawym górnym rogu.
- **Panel konta** (lewy dół, tylko po zalogowaniu; `UserMenu.tsx`): `--surface-raised`, `radius 14px`, awatar 34px
  (`--accent-brand`, inicjał we Fraunces), nazwa 13px/600 + e-mail 11px `--text-muted`, strzałki góra/dół.
  Nazwa to część e-maila przed `@`, bo backend nie zwraca nazwy użytkownika. Klik rozwija nad panelem menu
  (`--surface-card`, cień karty, wejście 0.16 s): „Ustawienia” (wyłączone, etykieta mono „WKRÓTCE”) i „Wyloguj”
  w `--accent-red`. Zamyka się Escape'em i kliknięciem obok. Ekran logowania zwija się do tego panelu.

### Topbar (`Topbar.tsx`)
- 68px, tło `--bg-page`, dolna ramka.
- Po lewej pigułka „Okienko czynne 24/7” (34px, zegar w `--accent-amber`).
- **Limit pytań wyczerpany:** pigułka zmienia się w „Okienko zamknięte jeszcze przez **7 h 45 min**”
  (zegar i obrys w `--accent-red`, tło `--accent-red` 8%, odliczanie co sekundę, widoczna też na telefonie).
  Blokadę znamy z nagłówków `RateLimit-Remaining` / `RateLimit-Reset` / `Retry-After` (`lib/quotaLock.ts`,
  zapamiętana w `localStorage` `gw-locked-until`), więc kolejne pytanie nie leci na serwer. Composer jest
  wtedy zablokowany z podpowiedzią „Limit pytań wyczerpany”, a pod nim stoi czerwony komunikat
  `QuotaNotice`: „**Osiągnięto limit pytań.** Reset za **7 h 44 min**.” (odliczanie, tło `--accent-red` 10%
  na `--surface-card`; niezalogowani mają przy nim przycisk „Zaloguj się”). Zastępuje zwykły dymek błędu. Logowanie i wylogowanie zdejmują blokadę
  (limit liczy się per konto). W okienku pojawia się wtedy **szary kot z tabliczką „CLOSED”**: wchodzi z prawej
  po ladzie, stawia tabliczkę na przodzie lady (obok kubka), odwraca się i wychodzi
  (9 s, raz na wejście sceny); tabliczka zostaje oparta i przechylona.
  Przy `prefers-reduced-motion` kota nie ma — tabliczka po prostu leży na ladzie.
- Po prawej przełącznik motywu (38px, `radius 11px`; ikona księżyc/słońce wynika z CSS, bez stanu Reacta) i przycisk „Zaloguj się” (`--surface-card`, obrys `--border-strong`), widoczny tylko dla niezalogowanych. Wylogowanie jest w panelu konta w sidebarze.

### Scena (`Scene.tsx`, `RoomArt.tsx`)
- Ściana: `linear-gradient(to bottom, --wall-top, --wall-bottom)`.
- Poświata `.glow`: elipsa 860 × 520, `radial-gradient` z `--glow`, `blur(40px)`, `opacity: --glow-strength`.
- Tabliczka nachodzi na framugę (`margin-bottom: -18px`), tło `--casing-lit`, ramka `--casing-shade`.
- Okienko: framuga `--casing` z jaśniejszą górną i ciemniejszą dolną krawędzią 3px, wnęka `--casing-shade`, wnętrze z wewnętrznym cieniem.
- Parapet: 30px `--sill` z jasną krawędzią 2px, pod nim lico 16px `--sill-face`.

### Composer (`Composer.tsx`)
- Karta `--surface-card`, `radius 18px`, padding `18px 20px 20px`, podwójny cień. Przy fokusie ramka przechodzi w niebieską.
- Textarea bez ramki, 16px. Rośnie z treścią do 190px, `maxLength 2000`.
- Pasek akcji: przyciski ikon 38px (`--surface-sunken`), podpowiedź 11.5px i okrągły przycisk wyślij 44px w `--accent-blue`. Zablokowany ma `opacity .45`.
- **Dyktowanie aktywne:** czerwone tło, pulsujący pierścień (`@keyframes pulse`, 1.4s).
- **Załączniki** (obecnie ukryte, `attachmentsEnabled={false}`, bo backend ich nie przyjmuje): chipy 30px, ikona PDF w czerwieni, obrazka w błękicie. Drag&drop daje przerywaną niebieską ramkę i napis „Upuść pliki…”.

### Podpowiedzi (`Landing.tsx`)
- Chipy-pigułki: `--surface-card`, padding `9px 16px`, 12.5px/500, lekki cień.
- Hover: `translateY(-1px)` i mocniejsza ramka. Kliknięcie wstawia treść do pola.
- Znikają, gdy trwa rozmowa.

### Wątek rozmowy (`ChatThread.tsx`) — nowy, jeszcze nie ma go w Figmie
- Zastępuje eyebrow, nagłówek i podtytuł nad okienkiem, gdy są wiadomości.
- **Okienko staje się nieruchomym tłem na środku obszaru rozmowy** (`.backdrop`, `inset: 0`, wyśrodkowane).
  Nie reaguje na pisanie ani na długość wątku. Przewija się tylko wątek (`.threadScroll`, miękkie
  wygaszenie u góry), pole pytania jest zadokowane na dole (`.dock`). Krótka rozmowa stoi przy polu
  pytania, dymki leżą na szybie. Stopka w trybie rozmowy jest ukryta.
- Dymek użytkownika: po prawej, `--accent-brand`, tekst `--text-inverse`, prawy dolny róg 4px.
- Dymek asystenta: po lewej, `--surface-card` z ramką, lewy dolny róg 4px, nad treścią etykieta mono „DZIEKANAT · OKIENKO 1”.
- Oczekiwanie na odpowiedź: dymek asystenta z kursywą „Szukam w segregatorach…”.
- Błąd: wyśrodkowana pigułka z tłem `color-mix(--accent-red 12%)`.
- Po każdej nowej wiadomości strona płynnie przewija się na dół.

### Stopka
`Made with ♥ by [znak Solvro] KN Solvro © 2026`, 12px `--text-muted`. Serce to `HeartIcon` w `--accent-red`,
znak Solvro to `public/brand/solvro-mark.png` (15px wysokości, `opacity 0.85`; w ciemnym motywie
rozjaśniony filtrem, bo granat gubi się na tle).

---

## 6. Ikony

- Własny zestaw SVG w `components/Icons.tsx`: `viewBox 24`, `stroke 1.9`, zaokrąglone końce, `currentColor`, domyślnie 18px (w UI 13–20px).
- Dostępne: Plus, Search, Message, Mic, Login, Logout, Settings, ChevronUpDown, Moon, Sun, Clock, Paperclip, ArrowUp, File, Image, X, Menu, GraphMark, Heart.
- **Nigdy emoji jako ikony.**

---

## 7. Ruch

Obecnie minimalny i funkcjonalny:

| Co | Jak |
|---|---|
| hovery przycisków | `0.14s ease` (tło, kolor, ramka) |
| chip / wyślij hover | `translateY(-1px)` |
| fokus karty pytania | `border-color 0.16s` |
| szuflada sidebara | `transform 0.22s ease` |
| dyktowanie | pulsujący pierścień 1.4s |
| wejście w rozmowę / „Nowa rozmowa” | `startTransition` + React `<ViewTransition>`: okienko (`gw-window`) i pole pytania (`gw-composer`) przejeżdżają na nowe miejsca (560 ms), powitanie gaśnie, wątek wjeżdża od dołu. CSS w `app/globals.css` |
| para z kubka | 3 smugi, `translateY` + `scale` + `opacity`, 3.6–4.1 s w pętli; poza `.depthBlur`, żeby nie przeliczać filtra pokoju |
| zmiana motywu | View Transitions API: nowy motyw rozlewa się kołem (`clip-path: circle()`) od przełącznika na cały ekran, 700 ms, `cubic-bezier(0.65,0,0.35,1)`; nowa ikona słońca/księżyca wjeżdża z obrotem. `components/ThemeToggle.tsx` |
| lampka | `opacity: var(--lamp-on)` z przejściem 0.6 s; przełącznik motywu ustawia `html[data-lamp]` → mruganie przy zapalaniu (1.4 s) albo gaśnięcie (0.7 s) |
| nowa wiadomość | `scrollIntoView({ behavior: "smooth" })` |
| ekran logowania | `<dialog>` z `clip-path: inset(…)` rośnie z prostokąta klikniętego przycisku do pełnego ekranu (720 ms, `cubic-bezier(0.76,0,0.24,1)`); kopia przycisku gaśnie i rośnie (`scale 1.6`), zasłona w `--surface-card` przenika w `--bg-page`; treść wchodzi kaskadą od 300 ms (`translateY 18px`, co 70 ms). Zamknięcie tą samą drogą do przycisku (540 ms). `components/auth/AuthOverlay.tsx` |

`prefers-reduced-motion: reduce` wyłącza animacje i przejścia globalnie. Nowa animacja musi to
respektować.

Na scenie ruszają się para z kubka i lampka (przy zmianie motywu). Drobinki kurzu i refleksy
są statyczne.

---

## 8. Dostępność

- Fokus: `outline 2px` w 60% `--accent-blue`, `offset 2px` (`:focus-visible`). Nie używamy `box-shadow`, bo zaginał krawędzie.
- Zaznaczenie tekstu: `--accent-blue` w 28%.
- Przyciski z samą ikoną mają `aria-label` po polsku. Stany mają `aria-pressed`, `aria-current` i `aria-busy`.
- Wątek rozmowy ma `aria-live="polite"`, a błędy `role="alert"`.
- Etykiety ukryte wizualnie przez klasę `.srOnly`.

---

## 9. Treść i ton

- Wszystko po polsku, bez lorem ipsum. Pytania są realistyczne i studenckie („Kiedy zaczyna się sesja?”, „Jak złożyć podanie o urlop?”).
- Ton uprzejmy i urzędowo-ciepły, jak w okienku: „Dzień dobry. Czym mogę służyć?”, „Szukam w segregatorach…”.
- Marka w UI to **Graf Wiedzy** (nie „Solvro”). Solvro pojawia się tylko w stopce.

---

## 10. Antywzorce (zakazane)

- generyczny fioletowo-niebieski gradient, glassmorphism bez uzasadnienia
- wycentrowane pole na pustym tle (pole zawsze stoi na parapecie okienka)
- emoji zamiast ikon
- paleta skopiowana z ChatGPT/Claude
- Tailwind — scena to precyzyjna grafika, więc style idą przez CSS Modules i tokeny
- kolory wpisane na sztywno w komponent zamiast przez zmienną

---

## 11. Różnice: kod vs Figma (do zsynchronizowania)

| Element | Figma | Kod (obecnie) |
|---|---|---|
| historia w sidebarze | 8 przykładowych rozmów, grupy Dzisiaj / 7 dni temu / Wcześniej | dane z backendu; nowy użytkownik widzi pusty stan „Brak rozmów”; grupy Dziś / Wczoraj / Ostatnie 7 dni / Starsze |
| załączniki w composerze | 2 chipy + spinacz + „PDF, DOCX, PNG — do 20 MB” | ukryte; podpowiedź „Enter — wyślij · Shift+Enter — nowa linia” |
| wątek rozmowy | brak ekranu | `ChatThread` (dymki, „Szukam w segregatorach…”) |
| stany logowania | tylko „Zaloguj się” | pełnoekranowe logowanie / rejestracja / reset hasła (lewa kolumna z nagłówkiem, po prawej okienko „DZIEKANAT · LOGOWANIE” z kartą formularza na parapecie); po zalogowaniu panel konta w lewym dolnym rogu (Ustawienia — wkrótce, Wyloguj) |
