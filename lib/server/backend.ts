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
