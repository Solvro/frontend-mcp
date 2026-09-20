import { titleFrom } from "../history";
import { ApiError, toApiError } from "./problem";
import type { AuthSession, ChatResponseDto, ConversationDto, MessageDto, QuotaInfo } from "./types";

async function request<T>(
  path: string,
  init: RequestInit = {},
  onHeaders?: (headers: Headers) => void,
): Promise<T> {
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

  onHeaders?.(response.headers);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw toApiError(response.status, body, response.headers.get("retry-after"));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const post = <T>(path: string, body?: unknown, onHeaders?: (headers: Headers) => void) =>
  request<T>(
    path,
    { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) },
    onHeaders,
  );

/** Dzienny limit pytań z nagłówków chat-service (RateLimit-Remaining / RateLimit-Reset). */
function quotaFrom(headers: Headers): QuotaInfo | null {
  const remaining = Number.parseInt(headers.get("ratelimit-remaining") ?? "", 10);
  const reset = Number.parseInt(headers.get("ratelimit-reset") ?? "", 10);
  if (!Number.isFinite(remaining) || !Number.isFinite(reset)) return null;
  return { remaining, resetSeconds: reset };
}

const session = (id: string) => `/bff/chat/api/sessions/${encodeURIComponent(id)}`;

export const api = {
  sendMessage: (message: string, sessionId: string | null, onQuota?: (quota: QuotaInfo) => void) =>
    post<ChatResponseDto>(
      "/bff/chat/api/chat",
      sessionId ? { message, session_id: sessionId } : { message, metadata: { title: titleFrom(message) } },
      (headers) => {
        const quota = quotaFrom(headers);
        if (quota) onQuota?.(quota);
      },
    ),
  listSessions: () => request<ConversationDto[]>("/bff/chat/api/users/me/sessions?limit=50"),
  getHistory: (id: string) => request<MessageDto[]>(`${session(id)}/history`),
  deleteSession: (id: string) => request<void>(session(id), { method: "DELETE" }),

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
