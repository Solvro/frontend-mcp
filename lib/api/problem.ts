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
