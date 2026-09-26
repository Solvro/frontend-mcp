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

async function requestRefresh(
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

/* auth-service rotuje refresh token i traktuje ponowne użycie starego jako kradzież
   (revoke_family — wylogowanie wszędzie). Równoległe żądania z tym samym tokenem
   (dwie karty, lista rozmów + historia) muszą więc dostać jedną rotację, a nie kilka.
   Wynik zostaje chwilę dłużej dla żądań, które wystartowały jeszcze ze starym ciasteczkiem. */
const REFRESH_REUSE_MS = 30_000;
const refreshes = new Map<string, Promise<TokenPair | null>>();

// ponytail: mapa w pamięci procesu — przy kilku instancjach BFF potrzebny wspólny lock (np. Redis).
function refreshTokens(
  fetchImpl: typeof fetch,
  refreshUrl: string,
  refreshToken: string,
): Promise<TokenPair | null> {
  const pending = refreshes.get(refreshToken);
  if (pending) return pending;
  const refresh = requestRefresh(fetchImpl, refreshUrl, refreshToken);
  refreshes.set(refreshToken, refresh);
  // kasujemy tylko własny wpis — timer nieudanej próby nie może usunąć udanej, nowszej
  const forget = () => {
    if (refreshes.get(refreshToken) === refresh) refreshes.delete(refreshToken);
  };
  /* Pamiętamy tylko udaną rotację. Odmowa (401) i błąd sieci znikają od razu: następne
     żądanie spróbuje od nowa, a śmieciowe ciasteczka nie zapychają pamięci przez 30 s. */
  refresh.then((tokens) => tokens ?? forget(), forget);
  setTimeout(forget, REFRESH_REUSE_MS).unref?.();
  return refresh;
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

/**
 * IP klienta dla limitów w backendzie (limit pytań anonimowych, logowania). Next nie zna
 * adresu gniazda — podaje go proxy/hosting przed BFF. Proxy *dopisuje* adres na końcu
 * `X-Forwarded-For`, więc wcześniejsze wpisy ustawił sam klient; bierzemy tylko ostatni,
 * inaczej dowolny nagłówek od klienta omijałby limit.
 */
export function clientIp(headers: Headers): string | null {
  const chain = headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean);
  return chain?.at(-1) ?? headers.get("x-real-ip")?.trim() ?? null;
}

/**
 * Nagłówek `X-Forwarded-For` z jednym, zaufanym adresem — do żądań BFF → serwis.
 * Tylko przy `BFF_TRUST_PROXY=1`: bez proxy przed Next nagłówek pochodzi prosto od klienta
 * i byłby podróbką. Wtedy nic nie wysyłamy — backend widzi IP serwera Next (wspólny limit,
 * ale nie do obejścia).
 */
export function forwardedFor(
  headers: Headers,
  env: Record<string, string | undefined> = process.env,
): Record<string, string> {
  if (env.BFF_TRUST_PROXY !== "1") return {};
  const ip = clientIp(headers);
  return ip ? { "x-forwarded-for": ip } : {};
}
