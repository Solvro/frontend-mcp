# Integracja frontendu z backend-mcp — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Podpiąć landing „Graf Wiedzy” do `backend-mcp`: wysyłanie pytań i wyświetlanie odpowiedzi, logowanie/rejestracja, historia rozmów zalogowanego użytkownika, strony z linków e-mail (weryfikacja, reset hasła).

**Architecture:** Przeglądarka rozmawia wyłącznie z Next.js (`/bff/*`, same-origin — zero CORS, zero self-signed TLS). Route handlery w `app/bff/` proxy'ują do `chat-service` i `auth-service`, trzymają tokeny JWT w ciasteczkach `httpOnly` (JS strony nigdy nie widzi tokenów) i same odświeżają access token przez `/auth/refresh`. Po stronie klienta: cienki klient `lib/api/client.ts` + hooki `useChat`, `useAuth`, `useConversations`.

**Tech Stack:** Next.js 16.3 (App Router, route handlers), React 19.2, TypeScript, CSS Modules, Vitest (nowy devDependency, tylko testy logiki w `lib/`).

**Spec:** brak osobnego dokumentu — wymagania z rozmowy (2026-09-18) + `CLAUDE.md` + kontrakt API odczytany z `../backend-mcp` (sekcja „Kontrakt backendu” niżej).

## Global Constraints

- **Żadnych commitów** (ani `git add`) — kroki „Checkpoint” to tylko `git status` / `git diff --stat` do przeglądu przez użytkownika (patrz `CLAUDE.md` → Git).
- Bez Tailwinda; style w CSS Modules, kolory wyłącznie przez zmienne z `app/globals.css` (działają w light i dark).
- Wszystkie teksty UI po polsku, bez emoji-ikon (ikony z `components/Icons.tsx`).
- Next 16 ma breaking changes — przed pisaniem route handlera/strony przeczytaj `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` i `.../04-functions/cookies.md`. `params` i `searchParams` to `Promise`, `cookies()` jest async.
- Wiadomość czatu: 1–2000 znaków (`CHAT_INPUT_MAX_LENGTH=2000` w backendzie).
- Brak nowych zależności runtime. Jedyny nowy pakiet: `vitest` (dev).
- Zmiany wizualne tej fazy są minimalne i funkcjonalne — dopracowanie wyglądu i animacji to osobny plan (następna faza).

## Kontrakt backendu (stan `backend-mcp` na 2026-09-18)

| Serwis | Port lokalny | Endpoint | Auth | Uwagi |
|---|---|---|---|---|
| chat | 8001 | `POST /api/chat` `{message, session_id?, metadata?}` → `{session_id, message, timestamp, metadata:{message_count, source, trace_id}}` | opcjonalny Bearer | limit dzienny: anonim 5, zalogowany 8 → `429` + `Retry-After`; odpowiedź może trwać do ~50 s (brak streamingu) |
| chat | 8001 | `GET /api/users/me/sessions?limit=` → `Conversation[]` (sort: `updated_at` malejąco) | wymagany | `Conversation = {session_id, user_id, created_at, updated_at, message_count, metadata, is_active, expires_at}` |
| chat | 8001 | `GET /api/sessions/{id}/history` → `Message[]` (chronologicznie) | wymagany | `Message = {id, session_id, role:"user"\|"assistant"\|"system", content, timestamp, metadata}` |
| chat | 8001 | `DELETE /api/sessions/{id}` → 204 | wymagany | |
| auth | 8000 | `POST /auth/login` `{email,password}` → `{access_token, refresh_token, token_type}` | – | `401 invalid_credentials`, `403 email_unverified` |
| auth | 8000 | `POST /auth/register` `{username(3–255), email, password(min 6)}` → 201 user | – | `409 email_or_username_already_registered`; mail z linkiem `FRONTEND_URL/auth/verify?token=…` |
| auth | 8000 | `POST /auth/refresh` `{refresh_token}` → nowa para | – | rotacja; reuse starego tokenu unieważnia całą rodzinę |
| auth | 8000 | `POST /auth/logout` `{refresh_token?}` → 204 | wymagany | |
| auth | 8000 | `GET /auth/verify?token=` | – | `400 invalid_or_expired_token` |
| auth | 8000 | `POST /auth/resend-verification`, `/auth/forgot-password` `{email}`; `POST /auth/reset-password` `{token,new_password}` | – | mail resetu → `FRONTEND_URL/auth/reset-password?token=…` |

Błędy: RFC 7807 — `{type, title, status, detail, request_id}`; `detail` to string (kod, np. `invalid_credentials`) albo tablica błędów walidacji `[{msg, loc, …}]` dla 422.
Daty: backend zapisuje UTC **bez strefy** (`"2026-09-18T10:00:00.123000"`) — frontend musi dokleić `Z`.
Access token zawiera tylko `sub`, `roles`, `email_verified` — **nie ma** endpointu `/auth/me` ani nazwy użytkownika; e-mail zapamiętujemy z formularza logowania.

## Braki po stronie backendu (poza zakresem tego planu — do zgłoszenia w backend-mcp)

1. **Załączniki** — brak endpointu uploadu (limit body 1 MiB). Frontend na razie ukrywa spinacz i drag&drop (`attachmentsEnabled={false}`).
2. **Klucz LLM nie trafia do kontenera** — `docker/compose.yml` nie przekazuje `OPENAI_API_KEY`/`GOOGLE_API_KEY` do `chat-service` (brak `env_file`), więc lokalnie odpowiedzi idą z surowego fallbacku grafu, bez LLM.
3. **Brak streamingu** — odpowiedź przychodzi w całości po kilkunastu–kilkudziesięciu sekundach; frontend pokazuje stan oczekiwania.
4. **Brak tytułu rozmowy** — obchodzimy: przy pierwszym pytaniu wysyłamy `metadata.title`, backend zapisuje je w `Conversation.metadata`.
5. **Brak źródeł w odpowiedzi** — tekst „Odpowiedzi zawierają odnośniki do regulaminów…” na razie jest obietnicą bez pokrycia; `ChatResponse` ma tylko `message`.
6. **Anonimowa rozmowa nie przechodzi na konto** po zalogowaniu (sesja ma `user_id=None`) — frontend po logowaniu zaczyna nową rozmowę.
7. **Rate limit per IP za BFF** — w produkcji wszystkie żądania przyjdą z IP serwera Next; trzeba ustawić `FORWARDED_ALLOW_IPS` na adres BFF (BFF przekazuje `X-Forwarded-For`).
8. **Brak `/auth/me`** — e-mail w UI pochodzi z formularza logowania (ciasteczko `gw_email`).

## Struktura plików

| Plik | Odpowiedzialność |
|---|---|
| `.env.example` (nowy) + `.gitignore` | adresy serwisów dla BFF |
| `vitest.config.ts` (nowy), `package.json` | runner testów |
| `lib/api/problem.ts` (+test) | parsowanie RFC 7807 → `ApiError` z polskim komunikatem |
| `lib/api/types.ts` | DTO backendu |
| `lib/api/client.ts` | funkcje przeglądarki wołające `/bff/*` |
| `lib/server/backend.ts` (+test) | adresy serwisów, proxy z auto-refreshem tokenu (czysta logika, wstrzykiwany `fetch`) |
| `lib/server/session.ts` | ciasteczka tokenów + przekazanie odpowiedzi backendu (`relay`) |
| `app/bff/chat/[...path]/route.ts` | proxy do chat-service z allowlistą ścieżek |
| `app/bff/auth/[action]/route.ts` | login/logout/session + pass-through reszty auth |
| `lib/history.ts` (+test) | tytuł z pytania, daty UTC, grupowanie historii, mapowanie wiadomości |
| `lib/types.ts` | + `ChatMessage` |
| `lib/useChat.ts` | stan rozmowy: wysyłanie, wczytanie historii, reset |
| `lib/useAuth.tsx` | kontekst logowania |
| `lib/useConversations.ts` | lista rozmów do sidebara |
| `components/ChatThread.tsx` + css | wątek wiadomości + stan oczekiwania |
| `components/auth/*` | dialog logowania, strony verify / reset, wspólne style formularzy |
| `components/Scene.tsx`, `Composer.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `Landing.tsx`, `Icons.tsx`, `app/page.tsx`, `lib/data.ts` | podpięcie |
| `app/auth/verify/page.tsx`, `app/auth/reset-password/page.tsx` | cele linków z maili |

---

### Task 0: Backend lokalnie + konfiguracja frontendu

**Files:**
- Create: `.env.example`, `.env.local` (lokalny, ignorowany)
- Modify: `.gitignore`

**Interfaces:**
- Produces: zmienne `CHAT_SERVICE_URL`, `AUTH_SERVICE_URL` (czytane tylko po stronie serwera Next).

- [ ] **Step 1: Uruchom graf wiedzy (MCP server)**

```bash
cd ../ml-mcp && just up-dev
```
Expected: kontener `mcp-server` działa w sieci `solvro-mcp-internal`.

- [ ] **Step 2: Uruchom backend**

```bash
cd ../backend-mcp
test -f .env || cp .env.example .env
just up
curl -s localhost:8001/health/ready && echo && curl -s localhost:8000/health/ready
```
Expected: oba zwracają JSON ze statusem OK.

- [ ] **Step 3: Smoke test czatu (anonimowo)**

```bash
curl -s -X POST localhost:8001/api/chat -H 'content-type: application/json' \
  -d '{"message":"Kiedy zaczyna się sesja?","metadata":{"title":"Kiedy zaczyna się sesja?"}}'
```
Expected: `{"session_id":"…","message":"…","metadata":{"source":"mcp_knowledge_graph"|"error"…}}`. `source: "error"` = MCP niedostępny (sprawdź Step 1), ale kontrakt działa.

- [ ] **Step 4: Plik środowiska frontendu**

Dopisz na końcu `.gitignore`:
```gitignore
!.env.example
```

Utwórz `.env.example`:
```bash
# Adresy serwisów backend-mcp widziane z serwera Next (BFF w app/bff).
# Domyślne porty z backend-mcp/docker/compose.yml (`just up`).
CHAT_SERVICE_URL=http://localhost:8001
AUTH_SERVICE_URL=http://localhost:8000
```

```bash
cp .env.example .env.local
```

- [ ] **Step 5: Checkpoint (bez commita)**

Run: `git status --short` — Expected: `.gitignore` zmieniony, `.env.example` nowy, `.env.local` niewidoczny.

---

### Task 1: Vitest + mapowanie błędów API

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`, `lib/api/problem.ts`, `lib/api/problem.test.ts`

**Interfaces:**
- Produces: `class ApiError extends Error { status: number; code: string; retryAfter: number | null }`, `toApiError(status: number, body: unknown, retryAfterHeader: string | null): ApiError`.

- [ ] **Step 1: Zainstaluj Vitest i dodaj skrypt**

```bash
npm install -D vitest
npm pkg set scripts.test="vitest run"
```

Utwórz `vitest.config.ts`:
```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Napisz test**

`lib/api/problem.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ApiError, toApiError } from "./problem";

describe("toApiError", () => {
  it("maps backend error codes to Polish messages", () => {
    const error = toApiError(401, { detail: "invalid_credentials" }, null);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(error.code).toBe("invalid_credentials");
    expect(error.message).toBe("Nieprawidłowy e-mail lub hasło.");
  });

  it("uses the first validation message as code for 422", () => {
    const error = toApiError(422, { detail: [{ msg: "Value error, too long", loc: ["body"] }] }, null);
    expect(error.code).toBe("Value error, too long");
    expect(error.message).toBe("Sprawdź wpisane dane.");
  });

  it("reports minutes left on 429", () => {
    const error = toApiError(429, { detail: "Daily quota exceeded." }, "120");
    expect(error.retryAfter).toBe(120);
    expect(error.message).toBe("Limit pytań wyczerpany — spróbuj ponownie za 2 min.");
  });

  it("falls back for server errors and non-JSON bodies", () => {
    const error = toApiError(503, null, null);
    expect(error.code).toBe("unknown_error");
    expect(error.message).toBe("Serwer nie odpowiada. Spróbuj ponownie za chwilę.");
  });
});
```

- [ ] **Step 3: Uruchom — ma nie przejść**

Run: `npm test` — Expected: FAIL, `Cannot find module './problem'`.

- [ ] **Step 4: Implementacja**

`lib/api/problem.ts`:
```ts
/** Błąd z backendu (RFC 7807) przetłumaczony na komunikat dla studenta. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Nieprawidłowy e-mail lub hasło.",
  email_unverified: "Najpierw potwierdź adres e-mail — link jest w wiadomości od nas.",
  email_or_username_already_registered: "Konto z tym e-mailem lub nazwą już istnieje.",
  invalid_or_expired_token: "Link wygasł albo został już użyty.",
  session_expired: "Sesja wygasła — zaloguj się ponownie.",
  "Session not found.": "Ta rozmowa wygasła — wyślij pytanie jeszcze raz, zacznę nową.",
  network_error: "Brak połączenia z serwerem.",
};

function codeFromDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first: unknown = detail[0];
    if (first && typeof first === "object" && "msg" in first && typeof first.msg === "string") {
      return first.msg;
    }
  }
  return "unknown_error";
}

function messageFor(status: number, code: string, retryAfter: number | null): string {
  if (MESSAGES[code]) return MESSAGES[code];
  if (status === 429) {
    return retryAfter === null
      ? "Limit pytań wyczerpany — spróbuj ponownie później."
      : `Limit pytań wyczerpany — spróbuj ponownie za ${Math.max(1, Math.ceil(retryAfter / 60))} min.`;
  }
  if (status === 422) return "Sprawdź wpisane dane.";
  if (status === 401) return "Zaloguj się, żeby kontynuować.";
  if (status >= 500) return "Serwer nie odpowiada. Spróbuj ponownie za chwilę.";
  return "Coś poszło nie tak. Spróbuj ponownie.";
}

export function toApiError(status: number, body: unknown, retryAfterHeader: string | null): ApiError {
  const detail = body && typeof body === "object" && "detail" in body ? body.detail : undefined;
  const code = codeFromDetail(detail);
  const parsed = retryAfterHeader === null ? Number.NaN : Number.parseInt(retryAfterHeader, 10);
  const retryAfter = Number.isFinite(parsed) ? parsed : null;
  return new ApiError(status, code, messageFor(status, code, retryAfter), retryAfter);
}
```

- [ ] **Step 5: Uruchom — ma przejść**

Run: `npm test` — Expected: 4 passed.

- [ ] **Step 6: Checkpoint (bez commita)** — `git status --short`.

---

### Task 2: Proxy z auto-refreshem tokenu + ciasteczka

**Files:**
- Create: `lib/server/backend.ts`, `lib/server/backend.test.ts`, `lib/server/session.ts`

**Interfaces:**
- Consumes: env `CHAT_SERVICE_URL`, `AUTH_SERVICE_URL` (Task 0).
- Produces:
  - `type TokenPair = { access_token: string; refresh_token: string }`
  - `serviceUrl(service: "chat" | "auth", env?: Record<string, string | undefined>): string`
  - `forwardWithRefresh(opts: ForwardOptions): Promise<{ response: Response; tokens: TokenPair | null; expired: boolean }>`
  - `session.ts`: `ACCESS_COOKIE`, `REFRESH_COOKIE`, `EMAIL_COOKIE`, `writeTokens(res: NextResponse, tokens: TokenPair, email?: string): void`, `clearTokens(res: NextResponse): void`, `relay(response: Response): Promise<NextResponse>`

- [ ] **Step 1: Napisz test**

`lib/server/backend.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { forwardWithRefresh, serviceUrl } from "./backend";

type Call = { url: string; auth: string | null };

function fakeFetch(responses: Response[]) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), auth: new Headers(init?.headers).get("authorization") });
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    return next;
  }) as typeof fetch;
  return { impl, calls };
}

const rotated = { access_token: "new-access", refresh_token: "new-refresh" };
const unauthorized = () => new Response(null, { status: 401 });
const base = {
  url: "http://chat/api/chat",
  init: { method: "POST", body: "{}" },
  refreshUrl: "http://auth/auth/refresh",
};

describe("serviceUrl", () => {
  it("strips the trailing slash", () => {
    expect(serviceUrl("chat", { CHAT_SERVICE_URL: "http://localhost:8001/" })).toBe("http://localhost:8001");
  });

  it("throws when the variable is missing", () => {
    expect(() => serviceUrl("auth", {})).toThrow("AUTH_SERVICE_URL");
  });
});

describe("forwardWithRefresh", () => {
  it("forwards anonymously without tokens", async () => {
    const { impl, calls } = fakeFetch([new Response("ok")]);
    const result = await forwardWithRefresh({ ...base, fetchImpl: impl });
    expect(calls).toEqual([{ url: base.url, auth: null }]);
    expect(result).toMatchObject({ tokens: null, expired: false });
  });

  it("attaches the access token", async () => {
    const { impl, calls } = fakeFetch([new Response("ok")]);
    await forwardWithRefresh({ ...base, accessToken: "a1", refreshToken: "r1", fetchImpl: impl });
    expect(calls[0].auth).toBe("Bearer a1");
  });

  it("refreshes first when only the refresh token is left", async () => {
    const { impl, calls } = fakeFetch([Response.json(rotated), new Response("ok")]);
    const result = await forwardWithRefresh({ ...base, refreshToken: "r1", fetchImpl: impl });
    expect(calls.map((c) => c.url)).toEqual([base.refreshUrl, base.url]);
    expect(calls[1].auth).toBe("Bearer new-access");
    expect(result.tokens).toEqual(rotated);
  });

  it("retries once after 401 with rotated tokens", async () => {
    const { impl, calls } = fakeFetch([unauthorized(), Response.json(rotated), new Response("ok")]);
    const result = await forwardWithRefresh({ ...base, accessToken: "old", refreshToken: "r1", fetchImpl: impl });
    expect(calls.map((c) => c.auth)).toEqual(["Bearer old", null, "Bearer new-access"]);
    expect(result.response.status).toBe(200);
    expect(result.tokens).toEqual(rotated);
  });

  it("reports an expired session when refresh fails", async () => {
    const { impl } = fakeFetch([unauthorized(), unauthorized()]);
    const result = await forwardWithRefresh({ ...base, accessToken: "old", refreshToken: "r1", fetchImpl: impl });
    expect(result.expired).toBe(true);
    expect(result.response.status).toBe(401);
    expect(await result.response.json()).toMatchObject({ detail: "session_expired" });
  });

  it("reports an expired session on 401 without a refresh token", async () => {
    const { impl } = fakeFetch([unauthorized()]);
    const result = await forwardWithRefresh({ ...base, accessToken: "old", fetchImpl: impl });
    expect(result.expired).toBe(true);
  });
});
```

- [ ] **Step 2: Uruchom — ma nie przejść**

Run: `npm test` — Expected: FAIL, `Cannot find module './backend'`.

- [ ] **Step 3: Implementacja logiki proxy**

`lib/server/backend.ts`:
```ts
export type Service = "chat" | "auth";
export type TokenPair = { access_token: string; refresh_token: string };

const ENV_NAMES: Record<Service, string> = {
  chat: "CHAT_SERVICE_URL",
  auth: "AUTH_SERVICE_URL",
};

export function serviceUrl(
  service: Service,
  env: Record<string, string | undefined> = process.env,
): string {
  const name = ENV_NAMES[service];
  const url = env[name];
  if (!url) throw new Error(`${name} is not set (see .env.example)`);
  return url.replace(/\/+$/, "");
}

type ForwardOptions = {
  url: string;
  /** `body` musi być stringiem — przy retry po 401 wysyłamy go drugi raz. */
  init: RequestInit;
  accessToken?: string;
  refreshToken?: string;
  refreshUrl: string;
  fetchImpl?: typeof fetch;
};

export type ForwardResult = { response: Response; tokens: TokenPair | null; expired: boolean };

function withBearer(init: RequestInit, token: string | undefined): RequestInit {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return { ...init, headers };
}

async function refreshTokens(
  fetchImpl: typeof fetch,
  refreshUrl: string,
  refreshToken: string,
): Promise<TokenPair | null> {
  const response = await fetchImpl(refreshUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  return response.ok ? ((await response.json()) as TokenPair) : null;
}

function expired(): ForwardResult {
  const response = Response.json(
    { type: "about:blank", title: "Unauthorized", status: 401, detail: "session_expired" },
    { status: 401 },
  );
  return { response, tokens: null, expired: true };
}

/**
 * Wysyła żądanie do serwisu z tokenem użytkownika. Brak access tokenu albo 401
 * → jedna próba odświeżenia przez /auth/refresh i powtórka. Nowe tokeny wracają
 * w `tokens`, żeby route handler zapisał je w ciasteczkach.
 */
export async function forwardWithRefresh({
  url,
  init,
  accessToken,
  refreshToken,
  refreshUrl,
  fetchImpl = fetch,
}: ForwardOptions): Promise<ForwardResult> {
  let tokens: TokenPair | null = null;
  let access = accessToken;

  if (!access && refreshToken) {
    tokens = await refreshTokens(fetchImpl, refreshUrl, refreshToken);
    if (!tokens) return expired();
    access = tokens.access_token;
  }

  let response = await fetchImpl(url, withBearer(init, access));
  if (response.status !== 401 || !access) return { response, tokens, expired: false };

  if (tokens || !refreshToken) return expired();
  tokens = await refreshTokens(fetchImpl, refreshUrl, refreshToken);
  if (!tokens) return expired();

  response = await fetchImpl(url, withBearer(init, tokens.access_token));
  if (response.status === 401) return expired();
  return { response, tokens, expired: false };
}
```

- [ ] **Step 4: Uruchom — ma przejść**

Run: `npm test` — Expected: wszystkie testy PASS.

- [ ] **Step 5: Ciasteczka i relay**

`lib/server/session.ts`:
```ts
import { NextResponse } from "next/server";
import type { TokenPair } from "./backend";

export const ACCESS_COOKIE = "gw_access";
export const REFRESH_COOKIE = "gw_refresh";
export const EMAIL_COOKIE = "gw_email";

// Czasy życia jak w backendzie (ACCESS_TOKEN_EXPIRE_MINUTES=30, REFRESH_TOKEN_EXPIRE_DAYS=7);
// access wygasa minutę wcześniej, żeby nie wysłać tokenu na granicy ważności.
const ACCESS_MAX_AGE = 29 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

const base = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/bff",
};

export function writeTokens(res: NextResponse, tokens: TokenPair, email?: string): void {
  res.cookies.set(ACCESS_COOKIE, tokens.access_token, { ...base, maxAge: ACCESS_MAX_AGE });
  res.cookies.set(REFRESH_COOKIE, tokens.refresh_token, { ...base, maxAge: REFRESH_MAX_AGE });
  if (email) res.cookies.set(EMAIL_COOKIE, email, { ...base, maxAge: REFRESH_MAX_AGE });
}

export function clearTokens(res: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, EMAIL_COOKIE]) {
    res.cookies.set(name, "", { ...base, maxAge: 0 });
  }
}

const RELAYED_HEADERS = ["content-type", "retry-after", "x-request-id"];

/** Przepisuje odpowiedź serwisu 1:1 (status, treść, istotne nagłówki). */
export async function relay(response: Response): Promise<NextResponse> {
  const headers = new Headers();
  for (const name of RELAYED_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body = response.status === 204 ? null : await response.arrayBuffer();
  return new NextResponse(body, { status: response.status, headers });
}
```

- [ ] **Step 6: Typy**

Run: `npx tsc --noEmit` — Expected: brak błędów.

- [ ] **Step 7: Checkpoint (bez commita)** — `git status --short`.

---

### Task 3: Route handlery BFF

**Files:**
- Create: `app/bff/chat/[...path]/route.ts`, `app/bff/auth/[action]/route.ts`

**Interfaces:**
- Consumes: `serviceUrl`, `forwardWithRefresh`, `TokenPair` (backend.ts); `ACCESS_COOKIE`, `REFRESH_COOKIE`, `EMAIL_COOKIE`, `writeTokens`, `clearTokens`, `relay` (session.ts).
- Produces (HTTP, same-origin):
  - `GET|POST|DELETE /bff/chat/api/...` — allowlista: `api/chat`, `api/sessions/{id}`, `api/sessions/{id}/history`, `api/sessions/{id}/deactivate`, `api/users/me/sessions`
  - `POST /bff/auth/login` → `{authenticated: true, email}` + ciasteczka
  - `POST /bff/auth/logout` → 204, czyści ciasteczka
  - `GET /bff/auth/session` → `{authenticated: boolean, email: string | null}`
  - `GET /bff/auth/verify?token=`; `POST /bff/auth/{register|resend-verification|forgot-password|reset-password}` — pass-through

- [ ] **Step 1: Przeczytaj docs Next 16**

Run: `sed -n 1,140p node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — sprawdź sygnaturę `params: Promise<…>`.

- [ ] **Step 2: Proxy czatu**

`app/bff/chat/[...path]/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { forwardWithRefresh, serviceUrl } from "@/lib/server/backend";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearTokens, relay, writeTokens } from "@/lib/server/session";

type Context = { params: Promise<{ path: string[] }> };

// Tylko endpointy, których używa UI — reszta chat-service (np. /metrics) nie wystaje na zewnątrz.
const ALLOWED = /^api\/(chat|users\/me\/sessions|sessions\/[\w-]+(\/history|\/deactivate)?)$/;

async function handle(request: NextRequest, { params }: Context) {
  const { path } = await params;
  const target = path.join("/");
  if (!ALLOWED.test(target)) {
    return NextResponse.json({ detail: "not_found" }, { status: 404 });
  }

  const hasBody = request.method !== "GET" && request.method !== "DELETE";
  const body = hasBody ? await request.text() : undefined;
  const headers = new Headers({ accept: "application/json" });
  if (body) headers.set("content-type", "application/json");
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

  const { response, tokens, expired } = await forwardWithRefresh({
    url: `${serviceUrl("chat")}/${target}${request.nextUrl.search}`,
    init: { method: request.method, headers, body, cache: "no-store" },
    accessToken: request.cookies.get(ACCESS_COOKIE)?.value,
    refreshToken: request.cookies.get(REFRESH_COOKIE)?.value,
    refreshUrl: `${serviceUrl("auth")}/auth/refresh`,
  });

  const out = await relay(response);
  if (tokens) writeTokens(out, tokens);
  if (expired) clearTokens(out);
  return out;
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
```

- [ ] **Step 3: Proxy auth**

`app/bff/auth/[action]/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { serviceUrl, type TokenPair } from "@/lib/server/backend";
import {
  ACCESS_COOKIE,
  EMAIL_COOKIE,
  REFRESH_COOKIE,
  clearTokens,
  relay,
  writeTokens,
} from "@/lib/server/session";

type Context = { params: Promise<{ action: string }> };

const PASS_THROUGH = new Set(["register", "resend-verification", "forgot-password", "reset-password"]);

const notFound = () => NextResponse.json({ detail: "not_found" }, { status: 404 });

function postJson(url: string, body: string, headers: HeadersInit = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
    cache: "no-store",
  });
}

export async function POST(request: NextRequest, { params }: Context) {
  const { action } = await params;
  const auth = `${serviceUrl("auth")}/auth`;

  if (action === "login") {
    const body = await request.text();
    const response = await postJson(`${auth}/login`, body);
    if (!response.ok) return relay(response);
    const tokens = (await response.json()) as TokenPair;
    const { email } = JSON.parse(body) as { email: string };
    const out = NextResponse.json({ authenticated: true, email });
    writeTokens(out, tokens, email);
    return out;
  }

  if (action === "logout") {
    const access = request.cookies.get(ACCESS_COOKIE)?.value;
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value ?? null;
    if (access) {
      // Wylogowanie lokalne ma się udać nawet przy niedostępnym backendzie.
      await postJson(`${auth}/logout`, JSON.stringify({ refresh_token: refresh }), {
        authorization: `Bearer ${access}`,
      }).catch(() => undefined);
    }
    const out = new NextResponse(null, { status: 204 });
    clearTokens(out);
    return out;
  }

  if (PASS_THROUGH.has(action)) {
    return relay(await postJson(`${auth}/${action}`, await request.text()));
  }

  return notFound();
}

export async function GET(request: NextRequest, { params }: Context) {
  const { action } = await params;

  if (action === "session") {
    const authenticated = request.cookies.has(REFRESH_COOKIE);
    const email = authenticated ? (request.cookies.get(EMAIL_COOKIE)?.value ?? null) : null;
    return NextResponse.json({ authenticated, email });
  }

  if (action === "verify") {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const url = `${serviceUrl("auth")}/auth/verify?token=${encodeURIComponent(token)}`;
    return relay(await fetch(url, { cache: "no-store" }));
  }

  return notFound();
}
```

- [ ] **Step 4: Weryfikacja curl przez Next**

```bash
npm run dev &   # jeśli nie działa
curl -s localhost:3000/bff/auth/session
curl -s -X POST localhost:3000/bff/chat/api/chat -H 'content-type: application/json' -d '{"message":"Ile ECTS na zaliczenie semestru?"}'
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/bff/chat/metrics
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/bff/chat/api/users/me/sessions
```
Expected: `{"authenticated":false,"email":null}`; JSON z `session_id` i `message`; `404`; `401`.

- [ ] **Step 5: Lint + typy**

Run: `npx eslint app components lib && npx tsc --noEmit` — Expected: czysto.

- [ ] **Step 6: Checkpoint (bez commita)** — `git status --short`.

---

### Task 4: Klient API + logika historii

**Files:**
- Create: `lib/api/types.ts`, `lib/api/client.ts`, `lib/history.ts`, `lib/history.test.ts`
- Modify: `lib/types.ts`

**Interfaces:**
- Consumes: `ApiError`, `toApiError` (Task 1); endpointy `/bff/*` (Task 3).
- Produces:
  - `types.ts`: `ChatResponseDto`, `ConversationDto`, `MessageDto`, `AuthSession = { authenticated: boolean; email: string | null }`
  - `lib/types.ts`: `ChatMessage = { id: string; role: "user" | "assistant"; content: string }`
  - `history.ts`: `titleFrom(message: string): string`, `parseBackendDate(value: string): Date`, `groupConversations(items: ConversationDto[], now?: Date): ConversationGroup[]`, `toChatMessages(items: MessageDto[]): ChatMessage[]`
  - `client.ts`: obiekt `api` z metodami `sendMessage(message, sessionId)`, `listSessions()`, `getHistory(id)`, `session()`, `login(email, password)`, `logout()`, `register(username, email, password)`, `resendVerification(email)`, `forgotPassword(email)`, `resetPassword(token, newPassword)`, `verifyEmail(token)`

- [ ] **Step 1: Typy DTO**

`lib/api/types.ts`:
```ts
/** Kształty odpowiedzi backend-mcp (chat-service / auth-service). Daty: UTC bez strefy. */
export type ChatResponseDto = {
  session_id: string;
  message: string;
  timestamp: string;
  metadata: { message_count: number; source: string; trace_id: string };
};

export type ConversationDto = {
  session_id: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  metadata: { title?: unknown } & Record<string, unknown>;
  is_active: boolean;
  expires_at: string | null;
};

export type MessageDto = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

export type AuthSession = { authenticated: boolean; email: string | null };
```

Dopisz na końcu `lib/types.ts`:
```ts
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
```

- [ ] **Step 2: Test logiki historii**

`lib/history.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { ConversationDto, MessageDto } from "./api/types";
import { groupConversations, parseBackendDate, titleFrom, toChatMessages } from "./history";

// Backend oddaje UTC bez "Z" — tak samo budujemy dane testowe.
const naiveUtc = (date: Date) => date.toISOString().slice(0, -1);

function conversation(id: string, updated: Date, title?: string): ConversationDto {
  return {
    session_id: id,
    user_id: "1",
    created_at: naiveUtc(updated),
    updated_at: naiveUtc(updated),
    message_count: 2,
    metadata: title ? { title } : {},
    is_active: true,
    expires_at: null,
  };
}

describe("titleFrom", () => {
  it("collapses whitespace", () => {
    expect(titleFrom("  Kiedy   zaczyna\nsię sesja? ")).toBe("Kiedy zaczyna się sesja?");
  });

  it("truncates long questions to 60 chars with an ellipsis", () => {
    const title = titleFrom("a".repeat(80));
    expect(title).toHaveLength(60);
    expect(title.endsWith("…")).toBe(true);
  });
});

describe("parseBackendDate", () => {
  it("treats zone-less timestamps as UTC", () => {
    expect(parseBackendDate("2026-09-18T10:00:00").toISOString()).toBe("2026-09-18T10:00:00.000Z");
  });

  it("keeps explicit zones", () => {
    expect(parseBackendDate("2026-09-18T10:00:00+02:00").toISOString()).toBe("2026-09-18T08:00:00.000Z");
  });
});

describe("groupConversations", () => {
  it("buckets by local day and falls back to a default title", () => {
    const now = new Date(2026, 8, 18, 12, 0);
    const groups = groupConversations(
      [
        conversation("a", new Date(2026, 8, 18, 9, 0), "Sesja zimowa"),
        conversation("b", new Date(2026, 8, 17, 20, 0), "Urlop dziekański"),
        conversation("c", new Date(2026, 8, 14, 8, 0)),
        conversation("d", new Date(2026, 7, 1, 8, 0), "Stypendium"),
      ],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Dziś", "Wczoraj", "Ostatnie 7 dni", "Starsze"]);
    expect(groups[2].items).toEqual([{ id: "c", title: "Rozmowa bez tytułu" }]);
  });

  it("drops empty buckets", () => {
    const now = new Date(2026, 8, 18, 12, 0);
    const groups = groupConversations([conversation("a", new Date(2026, 8, 18, 9, 0), "X")], now);
    expect(groups.map((g) => g.id)).toEqual(["today"]);
  });
});

describe("toChatMessages", () => {
  it("skips system messages", () => {
    const message = (id: string, role: MessageDto["role"]): MessageDto => ({
      id,
      session_id: "s",
      role,
      content: id,
      timestamp: "2026-09-18T10:00:00",
      metadata: {},
    });
    expect(toChatMessages([message("1", "system"), message("2", "user"), message("3", "assistant")])).toEqual([
      { id: "2", role: "user", content: "2" },
      { id: "3", role: "assistant", content: "3" },
    ]);
  });
});
```

- [ ] **Step 3: Uruchom — ma nie przejść**

Run: `npm test` — Expected: FAIL, `Cannot find module './history'`.

- [ ] **Step 4: Implementacja**

`lib/history.ts`:
```ts
import type { ConversationDto, MessageDto } from "./api/types";
import type { ChatMessage, ConversationGroup } from "./types";

const TITLE_MAX = 60;
const DAY_MS = 86_400_000;

/** Tytuł rozmowy z pierwszego pytania — backend nie ma własnego pola na tytuł. */
export function titleFrom(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  if (clean.length <= TITLE_MAX) return clean;
  return `${clean.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

/** Backend zapisuje UTC bez strefy ("2026-09-18T10:00:00") — bez "Z" JS wziąłby czas lokalny. */
export function parseBackendDate(value: string): Date {
  return new Date(/(Z|[+-]\d\d:\d\d)$/i.test(value) ? value : `${value}Z`);
}

function titleOf(conversation: ConversationDto): string {
  const title = conversation.metadata.title;
  return typeof title === "string" && title.trim() ? title : "Rozmowa bez tytułu";
}

export function groupConversations(items: ConversationDto[], now = new Date()): ConversationGroup[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const buckets = [
    { id: "today", label: "Dziś", from: today },
    { id: "yesterday", label: "Wczoraj", from: today - DAY_MS },
    { id: "week", label: "Ostatnie 7 dni", from: today - 7 * DAY_MS },
    { id: "older", label: "Starsze", from: Number.NEGATIVE_INFINITY },
  ];
  const groups: ConversationGroup[] = buckets.map(({ id, label }) => ({ id, label, items: [] }));

  for (const conversation of items) {
    const time = parseBackendDate(conversation.updated_at).getTime();
    const index = buckets.findIndex((bucket) => time >= bucket.from);
    // NaN (nieczytelna data) nie pasuje do żadnego progu — ląduje w „Starsze”.
    groups[index === -1 ? groups.length - 1 : index].items.push({ id: conversation.session_id, title: titleOf(conversation) });
  }

  return groups.filter((group) => group.items.length > 0);
}

export function toChatMessages(items: MessageDto[]): ChatMessage[] {
  return items.flatMap((message) =>
    message.role === "system" ? [] : [{ id: message.id, role: message.role, content: message.content }],
  );
}
```

- [ ] **Step 5: Uruchom — ma przejść**

Run: `npm test` — Expected: wszystkie PASS.

- [ ] **Step 6: Klient przeglądarki**

`lib/api/client.ts`:
```ts
import { titleFrom } from "../history";
import { ApiError, toApiError } from "./problem";
import type { AuthSession, ChatResponseDto, ConversationDto, MessageDto } from "./types";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "network_error", "Brak połączenia z serwerem.");
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw toApiError(response.status, body, response.headers.get("retry-after"));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

const session = (id: string) => `/bff/chat/api/sessions/${encodeURIComponent(id)}`;

export const api = {
  sendMessage: (message: string, sessionId: string | null) =>
    post<ChatResponseDto>(
      "/bff/chat/api/chat",
      sessionId ? { message, session_id: sessionId } : { message, metadata: { title: titleFrom(message) } },
    ),
  listSessions: () => request<ConversationDto[]>("/bff/chat/api/users/me/sessions?limit=50"),
  getHistory: (id: string) => request<MessageDto[]>(`${session(id)}/history`),

  session: () => request<AuthSession>("/bff/auth/session"),
  login: (email: string, password: string) => post<AuthSession>("/bff/auth/login", { email, password }),
  logout: () => post<void>("/bff/auth/logout"),
  register: (username: string, email: string, password: string) =>
    post<unknown>("/bff/auth/register", { username, email, password }),
  resendVerification: (email: string) => post<unknown>("/bff/auth/resend-verification", { email }),
  forgotPassword: (email: string) => post<unknown>("/bff/auth/forgot-password", { email }),
  resetPassword: (token: string, newPassword: string) =>
    post<unknown>("/bff/auth/reset-password", { token, new_password: newPassword }),
  verifyEmail: (token: string) => request<unknown>(`/bff/auth/verify?token=${encodeURIComponent(token)}`),
};
```

- [ ] **Step 7: Lint + typy + testy**

Run: `npx eslint app components lib && npx tsc --noEmit && npm test` — Expected: czysto.

- [ ] **Step 8: Checkpoint (bez commita)** — `git status --short`.

---

### Task 5: Rozmowa na landingu (anonimowo)

**Files:**
- Create: `lib/useChat.ts`, `components/ChatThread.tsx`, `components/ChatThread.module.css`
- Modify: `components/Scene.tsx`, `components/Composer.tsx`, `components/Landing.tsx`

**Interfaces:**
- Consumes: `api.sendMessage`, `api.getHistory` (Task 4), `ApiError`, `toChatMessages`, `ChatMessage`.
- Produces:
  - `useChat(options?: { onAnswer?: (sessionId: string) => void; onUnauthorized?: () => void })` → `{ messages: ChatMessage[]; sessionId: string | null; pending: boolean; error: string | null; send(text: string): Promise<boolean>; load(id: string): Promise<void>; reset(): void }`
  - `<ChatThread messages pending error />`
  - `Scene` — nowy opcjonalny prop `conversation?: ReactNode` (zastępuje nagłówek powitalny)
  - `Composer` — nowe opcjonalne propsy `disabled?: boolean`, `attachmentsEnabled?: boolean` (domyślnie `true`)

- [ ] **Step 1: Hook rozmowy**

`lib/useChat.ts`:
```ts
"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "./api/client";
import { ApiError } from "./api/problem";
import { toChatMessages } from "./history";
import type { ChatMessage } from "./types";

type UseChatOptions = {
  onAnswer?: (sessionId: string) => void;
  onUnauthorized?: () => void;
};

let sequence = 0;
const localId = () => `local-${++sequence}`;

export function useChat({ onAnswer, onUnauthorized }: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  // Rośnie przy reset/load — odpowiedź na porzuconą rozmowę jest ignorowana.
  const generation = useRef(0);

  const fail = useCallback(
    (cause: unknown) => {
      const apiError = cause instanceof ApiError ? cause : null;
      if (apiError?.status === 401) onUnauthorized?.();
      if (apiError?.status === 404) setSessionId(null);
      setError(apiError?.message ?? "Coś poszło nie tak. Spróbuj ponownie.");
    },
    [onUnauthorized],
  );

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const content = text.trim();
      if (!content || busy.current) return false;

      const turn = generation.current;
      const question: ChatMessage = { id: localId(), role: "user", content };
      busy.current = true;
      setPending(true);
      setError(null);
      setMessages((current) => [...current, question]);

      try {
        const response = await api.sendMessage(content, sessionId);
        if (turn !== generation.current) return true;
        setSessionId(response.session_id);
        setMessages((current) => [...current, { id: localId(), role: "assistant", content: response.message }]);
        onAnswer?.(response.session_id);
        return true;
      } catch (cause) {
        if (turn !== generation.current) return false;
        setMessages((current) => current.filter((message) => message.id !== question.id));
        fail(cause);
        return false;
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [sessionId, onAnswer, fail],
  );

  const load = useCallback(
    async (id: string) => {
      const turn = ++generation.current;
      setError(null);
      try {
        const history = await api.getHistory(id);
        if (turn !== generation.current) return;
        setSessionId(id);
        setMessages(toChatMessages(history));
      } catch (cause) {
        if (turn === generation.current) fail(cause);
      }
    },
    [fail],
  );

  const reset = useCallback(() => {
    generation.current += 1;
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, []);

  return { messages, sessionId, pending, error, send, load, reset };
}
```

- [ ] **Step 2: Wątek wiadomości**

`components/ChatThread.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";
import styles from "./ChatThread.module.css";

type ChatThreadProps = {
  messages: ChatMessage[];
  pending: boolean;
  error: string | null;
};

export function ChatThread({ messages, pending, error }: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  return (
    <section className={styles.thread} aria-label="Rozmowa" aria-live="polite" aria-busy={pending}>
      {messages.map((message) => (
        <article key={message.id} className={message.role === "user" ? styles.user : styles.assistant}>
          {message.role === "assistant" && <span className={styles.author}>Dziekanat · okienko 1</span>}
          <p className={styles.content}>{message.content}</p>
        </article>
      ))}

      {pending && (
        <article className={styles.assistant}>
          <span className={styles.author}>Dziekanat · okienko 1</span>
          <p className={`${styles.content} ${styles.typing}`}>Szukam w segregatorach…</p>
        </article>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div ref={endRef} />
    </section>
  );
}
```

`components/ChatThread.module.css`:
```css
.thread {
  width: min(760px, 100%);
  margin: 4px auto 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 4px;
}

.user,
.assistant {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 14px;
  font-size: 14.5px;
  line-height: 1.55;
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, calc(var(--shadow-a) * 0.6));
}

.user {
  align-self: flex-end;
  background: var(--accent-brand);
  color: var(--text-inverse);
  border-bottom-right-radius: 4px;
}

.assistant {
  align-self: flex-start;
  background: var(--surface-card);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  border-bottom-left-radius: 4px;
}

.author {
  display: block;
  margin-bottom: 4px;
  font-family: var(--font-mono), ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.content {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.typing {
  color: var(--text-secondary);
  font-style: italic;
}

.error {
  align-self: center;
  margin: 0;
  padding: 9px 14px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent-red) 12%, transparent);
  color: var(--accent-red);
  font-size: 12.5px;
  text-align: center;
}
```

- [ ] **Step 3: Scene — slot na rozmowę**

W `components/Scene.tsx` zamień typ propsów i blok nagłówka:
```tsx
type SceneProps = {
  /** Pierwszy plan — opiera się na parapecie okienka. */
  children: ReactNode;
  /** Wszystko poniżej pierwszego planu (podpowiedzi, stopka). */
  below?: ReactNode;
  /** Trwająca rozmowa — zastępuje powitanie nad okienkiem. */
  conversation?: ReactNode;
};

export function Scene({ children, below, conversation }: SceneProps) {
  return (
    <div className={styles.stage}>
      <div className={styles.glow} aria-hidden="true" />

      {conversation ?? (
        <>
          <p className={styles.eyebrow}>Asystent studenta · Politechnika Wrocławska</p>
          <h1 className={styles.heading}>Dzień dobry. Czym mogę służyć?</h1>
          <p className={styles.subtitle}>
            Pytaj o regulaminy, terminy, zapisy i stypendia — odpowiem i pokażę, z którego dokumentu
            to wynika.
          </p>
        </>
      )}

      <div className={styles.sceneWrap}>
```
(reszta pliku bez zmian)

- [ ] **Step 4: Composer — blokada w trakcie odpowiedzi, wyłączone załączniki, limit długości**

Zastąp całe `components/Composer.tsx`:
```tsx
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowUpIcon,
  FileIcon,
  ImageIcon,
  MicIcon,
  PaperclipIcon,
  XIcon,
} from "./Icons";
import styles from "./Composer.module.css";
import type { Attachment } from "@/lib/types";

/** Jak CHAT_INPUT_MAX_LENGTH w chat-service. */
const MAX_LENGTH = 2000;

type ComposerProps = {
  value: string;
  onValueChange: (value: string) => void;
  attachments: Attachment[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onSend: () => void;
  listening: boolean;
  onToggleListening: () => void;
  /** Czekamy na odpowiedź — pisać można, wysłać nie. */
  disabled?: boolean;
  /** Backend nie przyjmuje jeszcze plików — wtedy chowamy spinacz i drag&drop. */
  attachmentsEnabled?: boolean;
};

export function Composer({
  value,
  onValueChange,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  onSend,
  listening,
  onToggleListening,
  disabled = false,
  attachmentsEnabled = true,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragDepth, setDragDepth] = useState(0);

  // auto-grow — pole rośnie z treścią, do maks. wysokości z CSS
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const resize = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [value]);

  const hasContent = value.trim().length > 0 || (attachmentsEnabled && attachments.length > 0);
  const canSend = !disabled && hasContent;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSend();
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) onAddFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragDepth(0);
      if (event.dataTransfer.files?.length) onAddFiles(event.dataTransfer.files);
    },
    [onAddFiles],
  );

  const dropHandlers = attachmentsEnabled
    ? {
        onDragEnter: (e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          setDragDepth((d) => d + 1);
        },
        onDragOver: (e: DragEvent<HTMLDivElement>) => e.preventDefault(),
        onDragLeave: () => setDragDepth((d) => Math.max(0, d - 1)),
        onDrop: handleDrop,
      }
    : {};

  const hint = listening
    ? "Słucham…"
    : disabled
      ? "Czekam na odpowiedź…"
      : attachmentsEnabled
        ? "PDF, DOCX, PNG — do 20 MB"
        : "Enter — wyślij · Shift+Enter — nowa linia";

  return (
    <div className={`${styles.card} ${dragDepth > 0 ? styles.dragging : ""}`} {...dropHandlers}>
      {attachmentsEnabled && attachments.length > 0 && (
        <ul className={styles.attachments}>
          {attachments.map((file) => (
            <li key={file.id} className={styles.chip}>
              <span className={file.kind === "image" ? styles.chipImg : styles.chipPdf}>
                {file.kind === "image" ? <ImageIcon size={15} /> : <FileIcon size={15} />}
              </span>
              <span className={styles.chipName} title={file.name}>
                {file.name}
              </span>
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => onRemoveAttachment(file.id)}
                aria-label={`Usuń załącznik ${file.name}`}
              >
                <XIcon size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className={styles.srOnly} htmlFor="gw-question">
        Twoje pytanie
      </label>
      <textarea
        id="gw-question"
        ref={textareaRef}
        className={styles.input}
        rows={1}
        maxLength={MAX_LENGTH}
        value={value}
        placeholder="Jak wygląda procedura obrony inżynierki?"
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <div className={styles.actions}>
        {attachmentsEnabled && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
              className={styles.srOnly}
              onChange={handleFileInput}
            />
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Załącz plik"
            >
              <PaperclipIcon />
            </button>
          </>
        )}
        <button
          type="button"
          className={`${styles.iconButton} ${listening ? styles.listening : ""}`}
          onClick={onToggleListening}
          aria-pressed={listening}
          aria-label={listening ? "Zatrzymaj dyktowanie" : "Zadaj pytanie głosem"}
        >
          <MicIcon />
        </button>

        <p className={styles.hint}>{hint}</p>

        <button
          type="button"
          className={styles.send}
          onClick={onSend}
          disabled={!canSend}
          aria-label="Wyślij pytanie"
        >
          <ArrowUpIcon size={20} />
        </button>
      </div>

      {dragDepth > 0 && <div className={styles.dropHint}>Upuść pliki, żeby je załączyć</div>}
    </div>
  );
}
```

- [ ] **Step 5: Landing — podpięcie czatu**

Zastąp całe `components/Landing.tsx`:
```tsx
"use client";

import { useCallback, useState } from "react";
import { ChatThread } from "./ChatThread";
import { Composer } from "./Composer";
import { HeartIcon } from "./Icons";
import { Scene } from "./Scene";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { SUGGESTIONS } from "@/lib/data";
import { useChat } from "@/lib/useChat";
import { useDictation } from "@/lib/useDictation";
import type { Attachment } from "@/lib/types";
import styles from "./Landing.module.css";
import sceneStyles from "./Scene.module.css";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "avif"];

function toAttachment(file: File): Attachment {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    kind: IMAGE_EXTENSIONS.includes(extension) ? "image" : "file",
  };
}

export function Landing() {
  const [question, setQuestion] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const chat = useChat();
  const { listening, toggle: toggleListening } = useDictation(setQuestion);

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files).map(toAttachment);
    setAttachments((current) => {
      const known = new Set(current.map((file) => file.id));
      return [...current, ...incoming.filter((file) => !known.has(file.id))];
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => current.filter((file) => file.id !== id));
  }, []);

  const handleSend = async () => {
    const text = question;
    setQuestion("");
    if (!(await chat.send(text))) setQuestion(text);
  };

  const startNewChat = () => {
    chat.reset();
    setQuestion("");
    setAttachments([]);
    setStatus(null);
    setDrawerOpen(false);
  };

  const handleLogin = () => {
    // TODO(Task 7): dialog logowania.
    setStatus("Logowanie nie jest jeszcze podpięte.");
  };

  const hasConversation = chat.messages.length > 0 || chat.pending;

  return (
    <div className={styles.shell}>
      <Sidebar
        activeId={chat.sessionId}
        onSelect={() => setDrawerOpen(false)}
        onNewChat={startNewChat}
        onLogin={handleLogin}
        isDrawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      <div className={styles.main}>
        <Topbar onLogin={handleLogin} onOpenDrawer={() => setDrawerOpen(true)} />

        <div className={styles.scroll}>
          <Scene
            conversation={
              hasConversation ? (
                <ChatThread messages={chat.messages} pending={chat.pending} error={chat.error} />
              ) : undefined
            }
            below={
              <>
                {!hasConversation && (status ?? chat.error) && (
                  <p className={styles.status} role="status">
                    {status ?? chat.error}
                  </p>
                )}

                {!hasConversation && (
                  <div className={styles.suggestions}>
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className={styles.suggestion}
                        onClick={() => setQuestion(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                <p className={sceneStyles.trust}>
                  Odpowiedzi zawierają odnośniki do regulaminów i uchwał PWR · zawsze sprawdź źródło
                </p>

                <footer className={styles.footer}>
                  Made with
                  <span className={styles.heart}>
                    <HeartIcon size={13} />
                  </span>
                  by Solvro © 2026
                </footer>
              </>
            }
          >
            <Composer
              value={question}
              onValueChange={setQuestion}
              attachments={attachments}
              onAddFiles={addFiles}
              onRemoveAttachment={removeAttachment}
              onSend={handleSend}
              listening={listening}
              onToggleListening={toggleListening}
              disabled={chat.pending}
              attachmentsEnabled={false}
            />
          </Scene>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Lint + typy + testy**

Run: `npx eslint app components lib && npx tsc --noEmit && npm test` — Expected: czysto.

- [ ] **Step 7: Weryfikacja w przeglądarce (Playwright MCP)**

Przy działającym backendzie i `npm run dev`:
1. `browser_navigate` → `http://localhost:3000`
2. wpisz „Kiedy zaczyna się sesja?” w `#gw-question`, Enter
3. `browser_snapshot` — Expected: dymek pytania + „Szukam w segregatorach…”, po chwili odpowiedź asystenta; powitanie i chipy zniknęły
4. drugie pytanie w tej samej rozmowie — Expected: `browser_network_requests` pokazuje drugi `POST /bff/chat/api/chat` z `session_id`
5. „Nowa rozmowa” — Expected: wraca powitanie
6. `browser_take_screenshot` w light i dark, pokaż użytkownikowi

- [ ] **Step 8: Checkpoint (bez commita)** — `git status --short`.

---

### Task 6: Logowanie — kontekst i dialog

**Files:**
- Create: `lib/useAuth.tsx`, `components/auth/authForm.module.css`, `components/auth/AuthDialog.tsx`, `components/auth/AuthDialog.module.css`

**Interfaces:**
- Consumes: `api.session`, `api.login`, `api.logout`, `api.register`, `api.forgotPassword`, `api.resendVerification`, `ApiError`.
- Produces:
  - `<AuthProvider>`; `useAuth()` → `{ status: "loading" | "anonymous" | "authenticated"; email: string | null; login(email, password): Promise<void>; logout(): Promise<void>; markExpired(): void }`
  - `<AuthDialog open: boolean onClose: () => void onLoggedIn: () => void />`
  - `authForm.module.css` — klasy `form`, `field`, `input`, `submit`, `error`, `notice`, `link` (używane też w Task 8)

- [ ] **Step 1: Kontekst logowania**

`lib/useAuth.tsx`:
```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api/client";

type AuthStatus = "loading" | "anonymous" | "authenticated";

type AuthContextValue = {
  status: AuthStatus;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** BFF zgłosił wygasłą sesję (401) — przechodzimy w tryb anonimowy. */
  markExpired: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .session()
      .then((session) => {
        if (cancelled) return;
        setStatus(session.authenticated ? "authenticated" : "anonymous");
        setEmail(session.email);
      })
      .catch(() => {
        if (!cancelled) setStatus("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (address: string, password: string) => {
    const session = await api.login(address, password);
    setStatus("authenticated");
    setEmail(session.email);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setStatus("anonymous");
    setEmail(null);
  }, []);

  const markExpired = useCallback(() => {
    setStatus("anonymous");
    setEmail(null);
  }, []);

  const value = useMemo(
    () => ({ status, email, login, logout, markExpired }),
    [status, email, login, logout, markExpired],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within <AuthProvider>");
  return context;
}
```

- [ ] **Step 2: Wspólne style formularzy**

`components/auth/authForm.module.css`:
```css
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.input {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-raised);
  color: var(--text-primary);
  font: inherit;
  font-size: 14px;
}

.input:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 1px;
}

.submit {
  margin-top: 6px;
  padding: 11px 16px;
  border-radius: 10px;
  background: var(--accent-brand);
  color: var(--text-inverse);
  font-size: 14px;
  font-weight: 600;
}

.submit:disabled {
  opacity: 0.6;
  cursor: progress;
}

.error,
.notice {
  margin: 0;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 12.5px;
  line-height: 1.45;
}

.error {
  background: color-mix(in srgb, var(--accent-red) 12%, transparent);
  color: var(--accent-red);
}

.notice {
  background: var(--accent-blue-soft);
  color: var(--accent-blue);
}

.link {
  color: var(--accent-blue);
  font-size: 12.5px;
  text-decoration: underline;
  text-underline-offset: 2px;
}
```

- [ ] **Step 3: Dialog**

`components/auth/AuthDialog.module.css`:
```css
.dialog {
  width: min(400px, calc(100% - 32px));
  padding: 28px 26px 24px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  color: var(--text-primary);
  box-shadow: 0 24px 60px -12px rgba(0, 0, 0, calc(var(--shadow-a) * 2));
}

.dialog::backdrop {
  background: rgba(10, 14, 23, 0.45);
}

.close {
  position: absolute;
  top: 14px;
  right: 14px;
  display: inline-flex;
  padding: 6px;
  border-radius: 8px;
  color: var(--text-muted);
}

.close:hover {
  color: var(--text-primary);
  background: var(--surface-raised);
}

.title {
  margin: 0 0 18px;
  font-family: var(--font-display), Georgia, serif;
  font-size: 24px;
  font-weight: 600;
}

.links {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}
```

`components/auth/AuthDialog.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import { useAuth } from "@/lib/useAuth";
import { XIcon } from "../Icons";
import form from "./authForm.module.css";
import styles from "./AuthDialog.module.css";

type Mode = "login" | "register" | "forgot";

const TITLES: Record<Mode, string> = {
  login: "Zaloguj się",
  register: "Załóż konto",
  forgot: "Nie pamiętasz hasła?",
};

const SUBMIT_LABELS: Record<Mode, string> = {
  login: "Zaloguj się",
  register: "Załóż konto",
  forgot: "Wyślij link",
};

type AuthDialogProps = {
  open: boolean;
  onClose: () => void;
  onLoggedIn: () => void;
};

export function AuthDialog({ open, onClose, onLoggedIn }: AuthDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError(0, "unknown_error", "Coś poszło nie tak."));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (mode === "login") {
        await login(email, password);
        setPassword("");
        onLoggedIn();
      } else if (mode === "register") {
        await api.register(username, email, password);
        setPassword("");
        setMode("login");
        setNotice("Konto założone. Kliknij link z maila, żeby je potwierdzić, a potem się zaloguj.");
      } else {
        await api.forgotPassword(email);
        setNotice("Jeśli konto istnieje, wysłaliśmy link do zmiany hasła.");
      }
    });
  };

  const resendVerification = () =>
    void run(async () => {
      await api.resendVerification(email);
      setNotice("Wysłaliśmy nowy link potwierdzający.");
    });

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose} aria-labelledby="gw-auth-title">
      <button type="button" className={styles.close} onClick={onClose} aria-label="Zamknij">
        <XIcon size={16} />
      </button>

      <h2 id="gw-auth-title" className={styles.title}>
        {TITLES[mode]}
      </h2>

      <form className={form.form} onSubmit={handleSubmit}>
        {notice && <p className={form.notice}>{notice}</p>}
        {error && (
          <p className={form.error} role="alert">
            {error.message}{" "}
            {error.code === "email_unverified" && (
              <button type="button" className={form.link} onClick={resendVerification}>
                Wyślij link ponownie
              </button>
            )}
          </p>
        )}

        {mode === "register" && (
          <label className={form.field}>
            Nazwa użytkownika
            <input
              className={form.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={3}
              maxLength={255}
              autoComplete="username"
              required
            />
          </label>
        )}

        <label className={form.field}>
          E-mail
          <input
            className={form.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        {mode !== "forgot" && (
          <label className={form.field}>
            Hasło
            <input
              className={form.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={mode === "register" ? 6 : undefined}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              required
            />
          </label>
        )}

        <button type="submit" className={form.submit} disabled={busy}>
          {busy ? "Chwileczkę…" : SUBMIT_LABELS[mode]}
        </button>
      </form>

      <div className={styles.links}>
        {mode === "login" ? (
          <>
            <button type="button" className={form.link} onClick={() => switchMode("register")}>
              Załóż konto
            </button>
            <button type="button" className={form.link} onClick={() => switchMode("forgot")}>
              Nie pamiętam hasła
            </button>
          </>
        ) : (
          <button type="button" className={form.link} onClick={() => switchMode("login")}>
            Wróć do logowania
          </button>
        )}
      </div>
    </dialog>
  );
}
```

- [ ] **Step 4: Lint + typy**

Run: `npx eslint app components lib && npx tsc --noEmit` — Expected: czysto.

- [ ] **Step 5: Checkpoint (bez commita)** — `git status --short`.

---

### Task 7: Logowanie + historia w UI

**Files:**
- Create: `lib/useConversations.ts`
- Modify: `components/Icons.tsx`, `components/Topbar.tsx`, `components/Sidebar.tsx`, `components/Landing.tsx`, `app/page.tsx`, `lib/data.ts`

**Interfaces:**
- Consumes: `useAuth`, `AuthProvider`, `AuthDialog` (Task 6); `useChat` (Task 5); `api.listSessions`, `groupConversations` (Task 4).
- Produces: `useConversations(enabled: boolean)` → `{ groups: ConversationGroup[]; refresh: () => Promise<void> }`; `LogoutIcon`; `Sidebar` z propsami `groups`, `isAuthenticated`; `Topbar` z propsami `status`, `email`, `onLogout`.

- [ ] **Step 1: Hook historii**

`lib/useConversations.ts`:
```ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api/client";
import type { ConversationDto } from "./api/types";
import { groupConversations } from "./history";

export function useConversations(enabled: boolean) {
  const [items, setItems] = useState<ConversationDto[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setItems(await api.listSessions());
    } catch {
      // Sidebar zostaje z poprzednią listą — historia nie jest krytyczna dla rozmowy.
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groups = useMemo(() => (enabled ? groupConversations(items) : []), [enabled, items]);
  return { groups, refresh };
}
```

- [ ] **Step 2: Ikona wylogowania**

Dopisz w `components/Icons.tsx` pod `LoginIcon`:
```tsx
export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Icon>
);
```

- [ ] **Step 3: Topbar**

Zastąp całe `components/Topbar.tsx`:
```tsx
"use client";

import { ClockIcon, LoginIcon, LogoutIcon, MenuIcon } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./Topbar.module.css";

type TopbarProps = {
  status: "loading" | "anonymous" | "authenticated";
  email: string | null;
  onLogin: () => void;
  onLogout: () => void;
  onOpenDrawer: () => void;
};

export function Topbar({ status, email, onLogin, onLogout, onOpenDrawer }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <button
        type="button"
        className={styles.menuButton}
        onClick={onOpenDrawer}
        aria-label="Pokaż historię rozmów"
      >
        <MenuIcon />
      </button>

      <div className={styles.pill}>
        <span className={styles.pillIcon}>
          <ClockIcon size={15} />
        </span>
        Okienko czynne 24/7
      </div>

      <div className={styles.spacer} />

      <ThemeToggle className={styles.iconButton} />

      {status === "authenticated" && (
        <button type="button" className={styles.login} onClick={onLogout} title={email ?? undefined}>
          <LogoutIcon size={16} />
          <span className={styles.loginLabel}>Wyloguj</span>
        </button>
      )}
      {status === "anonymous" && (
        <button type="button" className={styles.login} onClick={onLogin}>
          <LoginIcon size={16} />
          <span className={styles.loginLabel}>Zaloguj się</span>
        </button>
      )}
    </header>
  );
}
```

- [ ] **Step 4: Sidebar**

Zastąp całe `components/Sidebar.tsx`:
```tsx
"use client";

import { useMemo, useState } from "react";
import { GraphMark, LoginIcon, MessageIcon, PlusIcon, SearchIcon, XIcon } from "./Icons";
import type { ConversationGroup } from "@/lib/types";
import styles from "./Sidebar.module.css";

type SidebarProps = {
  groups: ConversationGroup[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onLogin: () => void;
  isAuthenticated: boolean;
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
};

export function Sidebar({
  groups,
  activeId,
  onSelect,
  onNewChat,
  onLogin,
  isAuthenticated,
  isDrawerOpen,
  onCloseDrawer,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [showLoginCard, setShowLoginCard] = useState(true);

  const hasHistory = groups.length > 0;

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.title.toLowerCase().includes(q)),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  return (
    <>
      {isDrawerOpen && <div className={styles.scrim} onClick={onCloseDrawer} />}

      <aside
        className={`${styles.sidebar} ${styles.drawer} ${isDrawerOpen ? styles.drawerOpen : ""}`}
        aria-label="Historia rozmów"
      >
        <div className={styles.brand}>
          <span className={styles.mark}>
            <GraphMark size={20} />
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>Graf Wiedzy</span>
            <span className={styles.brandSub}>Asystent studenta</span>
          </span>
        </div>

        <button type="button" className={styles.newChat} onClick={onNewChat}>
          <PlusIcon size={16} />
          Nowa rozmowa
        </button>

        {hasHistory && (
          <div className={styles.search}>
            <SearchIcon size={15} />
            <input
              className={styles.searchInput}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Szukaj w rozmowach"
              aria-label="Szukaj w rozmowach"
            />
          </div>
        )}

        <nav className={styles.history}>
          {!hasHistory && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>
                <MessageIcon size={18} />
              </span>
              <p className={styles.emptyTitle}>Brak rozmów</p>
              <p className={styles.emptyText}>
                {isAuthenticated
                  ? "Zadaj pierwsze pytanie w okienku — rozmowa pojawi się tutaj."
                  : "Zaloguj się, a Twoje rozmowy zapiszą się tutaj."}
              </p>
            </div>
          )}

          {hasHistory && visibleGroups.length === 0 && (
            <p className={styles.empty}>Brak pasujących rozmów.</p>
          )}

          {visibleGroups.map((group) => (
            <section key={group.id} className={styles.group}>
              <h2 className={styles.groupLabel}>{group.label}</h2>
              <ul className={styles.list}>
                {group.items.map((item) => {
                  const isActive = item.id === activeId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => onSelect(item.id)}
                      >
                        <span className={styles.itemIcon}>
                          <MessageIcon size={14} />
                        </span>
                        <span>{item.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        {!isAuthenticated && showLoginCard && (
          <div className={styles.loginCard} role="note">
            <button
              type="button"
              className={styles.loginClose}
              onClick={() => setShowLoginCard(false)}
              aria-label="Zamknij"
            >
              <XIcon size={13} />
            </button>
            <p className={styles.loginText}>
              Zaloguj się, aby zapisywać historię rozmów i wracać do odpowiedzi.
            </p>
            <button type="button" className={styles.loginButton} onClick={onLogin}>
              <LoginIcon size={15} />
              Zaloguj się
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
```

- [ ] **Step 5: Usuń statyczną historię**

Zastąp całe `lib/data.ts`:
```ts
export const SUGGESTIONS = [
  "Kiedy zaczyna się sesja?",
  "Ile ECTS na zaliczenie semestru?",
  "Jak złożyć podanie o urlop?",
  "Terminy zapisów na kursy",
];
```

- [ ] **Step 6: Landing — wersja finalna**

Zastąp całe `components/Landing.tsx`:
```tsx
"use client";

import { useCallback, useState } from "react";
import { AuthDialog } from "./auth/AuthDialog";
import { ChatThread } from "./ChatThread";
import { Composer } from "./Composer";
import { HeartIcon } from "./Icons";
import { Scene } from "./Scene";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { SUGGESTIONS } from "@/lib/data";
import { useAuth } from "@/lib/useAuth";
import { useChat } from "@/lib/useChat";
import { useConversations } from "@/lib/useConversations";
import { useDictation } from "@/lib/useDictation";
import type { Attachment } from "@/lib/types";
import styles from "./Landing.module.css";
import sceneStyles from "./Scene.module.css";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "avif"];

function toAttachment(file: File): Attachment {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    kind: IMAGE_EXTENSIONS.includes(extension) ? "image" : "file",
  };
}

export function Landing() {
  const auth = useAuth();
  const isAuthenticated = auth.status === "authenticated";
  const conversations = useConversations(isAuthenticated);
  const chat = useChat({ onAnswer: conversations.refresh, onUnauthorized: auth.markExpired });

  const [question, setQuestion] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const { listening, toggle: toggleListening } = useDictation(setQuestion);

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files).map(toAttachment);
    setAttachments((current) => {
      const known = new Set(current.map((file) => file.id));
      return [...current, ...incoming.filter((file) => !known.has(file.id))];
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => current.filter((file) => file.id !== id));
  }, []);

  const handleSend = async () => {
    const text = question;
    setQuestion("");
    if (!(await chat.send(text))) setQuestion(text);
  };

  const startNewChat = () => {
    chat.reset();
    setQuestion("");
    setAttachments([]);
    setDrawerOpen(false);
  };

  const openConversation = (id: string) => {
    setDrawerOpen(false);
    void chat.load(id);
  };

  // Anonimowa rozmowa nie przechodzi na konto (backend) — po zmianie tożsamości zaczynamy od nowa.
  const handleLoggedIn = () => {
    setAuthOpen(false);
    startNewChat();
  };

  const handleLogout = async () => {
    await auth.logout();
    startNewChat();
  };

  const hasConversation = chat.messages.length > 0 || chat.pending;

  return (
    <div className={styles.shell}>
      <Sidebar
        groups={conversations.groups}
        activeId={chat.sessionId}
        onSelect={openConversation}
        onNewChat={startNewChat}
        onLogin={() => setAuthOpen(true)}
        isAuthenticated={isAuthenticated}
        isDrawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      <div className={styles.main}>
        <Topbar
          status={auth.status}
          email={auth.email}
          onLogin={() => setAuthOpen(true)}
          onLogout={handleLogout}
          onOpenDrawer={() => setDrawerOpen(true)}
        />

        <div className={styles.scroll}>
          <Scene
            conversation={
              hasConversation ? (
                <ChatThread messages={chat.messages} pending={chat.pending} error={chat.error} />
              ) : undefined
            }
            below={
              <>
                {!hasConversation && chat.error && (
                  <p className={styles.status} role="alert">
                    {chat.error}
                  </p>
                )}

                {!hasConversation && (
                  <div className={styles.suggestions}>
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className={styles.suggestion}
                        onClick={() => setQuestion(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                <p className={sceneStyles.trust}>
                  Odpowiedzi zawierają odnośniki do regulaminów i uchwał PWR · zawsze sprawdź źródło
                </p>

                <footer className={styles.footer}>
                  Made with
                  <span className={styles.heart}>
                    <HeartIcon size={13} />
                  </span>
                  by Solvro © 2026
                </footer>
              </>
            }
          >
            <Composer
              value={question}
              onValueChange={setQuestion}
              attachments={attachments}
              onAddFiles={addFiles}
              onRemoveAttachment={removeAttachment}
              onSend={handleSend}
              listening={listening}
              onToggleListening={toggleListening}
              disabled={chat.pending}
              attachmentsEnabled={false}
            />
          </Scene>
        </div>
      </div>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onLoggedIn={handleLoggedIn} />
    </div>
  );
}
```

- [ ] **Step 7: Provider na stronie**

Zastąp całe `app/page.tsx`:
```tsx
import { Landing } from "@/components/Landing";
import { AuthProvider } from "@/lib/useAuth";

export default function Home() {
  return (
    <AuthProvider>
      <Landing />
    </AuthProvider>
  );
}
```

- [ ] **Step 8: Lint + typy + testy**

Run: `npx eslint app components lib && npx tsc --noEmit && npm test` — Expected: czysto.

- [ ] **Step 9: Weryfikacja w przeglądarce (Playwright MCP + Mailpit)**

1. `http://localhost:3000` → „Zaloguj się” → „Załóż konto” → nazwa `student1`, e-mail `student1@example.com`, hasło `haslo123` → Expected: komunikat o linku w mailu
2. `http://localhost:8025` (Mailpit) → otwórz mail → skopiuj token z linku (strona `/auth/verify` powstaje w Task 8, na razie potwierdź przez `curl -s "localhost:3000/bff/auth/verify?token=<TOKEN>"`)
3. Zaloguj się → Expected: w topbarze „Wyloguj”, karta logowania w sidebarze znika
4. Zadaj pytanie → Expected: rozmowa pojawia się w sidebarze w grupie „Dziś” z tytułem = pytanie
5. „Nowa rozmowa”, potem klik w rozmowę z sidebara → Expected: wczytana historia
6. Przeładuj stronę → Expected: dalej zalogowany (ciasteczko), historia widoczna
7. „Wyloguj” → Expected: stan anonimowy, pusta historia z tekstem „Zaloguj się, a Twoje rozmowy…”
8. Screenshoty light + dark → pokaż użytkownikowi

- [ ] **Step 10: Checkpoint (bez commita)** — `git status --short`.

---

### Task 8: Strony z linków e-mail (weryfikacja, reset hasła)

**Files:**
- Create: `components/auth/AuthPage.tsx`, `components/auth/AuthPage.module.css`, `components/auth/VerifyEmail.tsx`, `components/auth/ResetPassword.tsx`, `app/auth/verify/page.tsx`, `app/auth/reset-password/page.tsx`

**Interfaces:**
- Consumes: `api.verifyEmail`, `api.resetPassword`, `ApiError`, `authForm.module.css` (Task 6).
- Produces: trasy `/auth/verify?token=` i `/auth/reset-password?token=` (backend buduje te linki z `FRONTEND_URL`).

- [ ] **Step 1: Układ strony**

`components/auth/AuthPage.module.css`:
```css
.page {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px 16px;
  background: linear-gradient(to bottom, var(--wall-top), var(--wall-bottom));
}

.card {
  width: min(420px, 100%);
  padding: 28px 26px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  box-shadow: 0 18px 44px -10px rgba(0, 0, 0, var(--scene-shadow-a));
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-weight: 600;
  text-decoration: none;
}

.mark {
  display: inline-flex;
  color: var(--accent-brand);
}

.title {
  margin: 18px 0 16px;
  font-family: var(--font-display), Georgia, serif;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}
```

`components/auth/AuthPage.tsx`:
```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { GraphMark } from "../Icons";
import styles from "./AuthPage.module.css";

export function AuthPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Link href="/" className={styles.brand}>
          <span className={styles.mark}>
            <GraphMark size={18} />
          </span>
          Graf Wiedzy
        </Link>
        <h1 className={styles.title}>{title}</h1>
        {children}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Weryfikacja e-maila**

Token zużywamy dopiero po kliknięciu — skanery linków w skrzynkach otwierają URL-e i zjadłyby jednorazowy token.

`components/auth/VerifyEmail.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import { AuthPage } from "./AuthPage";
import form from "./authForm.module.css";

export function VerifyEmail({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(token ? null : "Link jest niepełny — brak tokenu.");

  const confirm = async () => {
    setState("busy");
    setError(null);
    try {
      await api.verifyEmail(token);
      setState("done");
    } catch (cause) {
      setState("idle");
      setError(cause instanceof ApiError ? cause.message : "Nie udało się potwierdzić adresu.");
    }
  };

  return (
    <AuthPage title="Potwierdź adres e-mail">
      <div className={form.form}>
        {state === "done" ? (
          <p className={form.notice}>
            Adres potwierdzony.{" "}
            <Link href="/" className={form.link}>
              Wróć do okienka
            </Link>{" "}
            i zaloguj się.
          </p>
        ) : (
          <>
            {error && (
              <p className={form.error} role="alert">
                {error}
              </p>
            )}
            {token && (
              <button type="button" className={form.submit} onClick={confirm} disabled={state === "busy"}>
                {state === "busy" ? "Potwierdzam…" : "Potwierdź e-mail"}
              </button>
            )}
          </>
        )}
      </div>
    </AuthPage>
  );
}
```

`app/auth/verify/page.tsx`:
```tsx
import { VerifyEmail } from "@/components/auth/VerifyEmail";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <VerifyEmail token={token ?? ""} />;
}
```

- [ ] **Step 3: Reset hasła**

`components/auth/ResetPassword.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import { AuthPage } from "./AuthPage";
import form from "./authForm.module.css";

export function ResetPassword({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "Link jest niepełny — brak tokenu.");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== repeat) {
      setError("Hasła się różnią.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Nie udało się zmienić hasła.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPage title="Ustaw nowe hasło">
      {done ? (
        <p className={form.notice}>
          Hasło zmienione.{" "}
          <Link href="/" className={form.link}>
            Wróć do okienka
          </Link>{" "}
          i zaloguj się nowym hasłem.
        </p>
      ) : (
        <form className={form.form} onSubmit={handleSubmit}>
          {error && (
            <p className={form.error} role="alert">
              {error}
            </p>
          )}
          <label className={form.field}>
            Nowe hasło
            <input
              className={form.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              required
            />
          </label>
          <label className={form.field}>
            Powtórz hasło
            <input
              className={form.input}
              type="password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              required
            />
          </label>
          <button type="submit" className={form.submit} disabled={busy || !token}>
            {busy ? "Zapisuję…" : "Zmień hasło"}
          </button>
        </form>
      )}
    </AuthPage>
  );
}
```

`app/auth/reset-password/page.tsx`:
```tsx
import { ResetPassword } from "@/components/auth/ResetPassword";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ResetPassword token={token ?? ""} />;
}
```

- [ ] **Step 4: Lint + typy + build**

Run: `npx eslint app components lib && npx tsc --noEmit && npm test && npm run build` — Expected: czysto, build OK.

- [ ] **Step 5: Weryfikacja (Playwright MCP + Mailpit)**

1. Zarejestruj nowe konto z dialogu → otwórz link z Mailpit (`http://localhost:8025`) → Expected: strona „Potwierdź adres e-mail”, po kliknięciu „Adres potwierdzony”
2. Ten sam link drugi raz → Expected: „Link wygasł albo został już użyty.”
3. Dialog → „Nie pamiętam hasła” → e-mail → link z Mailpit → nowe hasło ×2 → Expected: „Hasło zmienione”; logowanie nowym hasłem działa
4. Screenshoty obu stron w light i dark → pokaż użytkownikowi

- [ ] **Step 6: Checkpoint (bez commita)** — `git status --short`.

---

### Task 9: Dokumentacja i końcowa weryfikacja

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Zaktualizuj CLAUDE.md**

W sekcji `## Projekt` zamień akapit „Aktualny etap” na:
```markdown
**Aktualny etap:** frontend podpięty do `../backend-mcp` przez BFF w Next (`app/bff/*`).
Następny krok: dopracowanie wizualne i animacje (osobny plan).
```

W sekcji „Integracja z backendem” (dodana 2026-09-18) zmień status planu na „zrealizowany” i zostaw listę braków backendu aktualną.

W `## Stack i komendy` dopisz:
```bash
npm test        # vitest — logika w lib/
```

- [ ] **Step 2: Pełna weryfikacja**

Run: `npx eslint app components lib && npx tsc --noEmit && npm test && npm run build` — Expected: wszystko zielone.

- [ ] **Step 3: Scenariusz błędów (Playwright MCP)**

1. Zatrzymaj chat-service (`docker compose -f ../backend-mcp/docker/compose.yml stop chat-service`), wyślij pytanie → Expected: „Serwer nie odpowiada…”, pytanie wraca do pola tekstowego; `start chat-service` po teście
2. Anonimowo wyślij 6 pytań → Expected: przy 6. „Limit pytań wyczerpany — spróbuj ponownie za N min.”
3. Pole tekstowe nie przyjmuje więcej niż 2000 znaków

- [ ] **Step 4: Checkpoint (bez commita)** — `git status --short` + `git diff --stat`; przekaż użytkownikowi listę zmienionych plików do przeglądu.
