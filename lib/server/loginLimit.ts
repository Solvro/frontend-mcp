import { isIP } from "node:net";

/* Limity prób logowania. auth-service liczy próby tylko per IP, więc atak z wielu adresów
   na jeden e-mail nie miał hamulca. Na produkcji /auth/login jest osiągalny wyłącznie przez BFF,
   dlatego wystarczy liczyć tutaj. Dwa liczniki (OWASP):
   - IP + e-mail, niski próg — zgadywanie z jednego źródła; atakujący blokuje tylko siebie,
     właściciel konta loguje się dalej z własnego adresu,
   - sam e-mail, wyższy próg — atak rozproszony po wielu IP. */
export const MAX_ATTEMPTS_PER_IP_EMAIL = 5;
export const MAX_ATTEMPTS_PER_EMAIL = 50;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED = 100_000;
// RFC 5321: dłuższy adres i tak nie przejdzie walidacji w backendzie
export const MAX_EMAIL_LENGTH = 254;

type Entry = { attempts: number; resetAt: number };

// ponytail: mapa w pamięci procesu — przy kilku instancjach BFF licznik trzeba przenieść do Redisa.
const entries = new Map<string, Entry>();

/* Backend (pydantic EmailStr) sprowadza domenę do ASCII — `ｐｗｒ.edu.pl` to dla niego `pwr.edu.pl`.
   NFKC robi to samo, więc warianty zapisu jednego konta trafiają do jednego licznika. */
const normalize = (email: string) => email.normalize("NFKC").trim().toLowerCase();

/* Bez zaufanego IP (brak BFF_TRUST_PROXY) wszyscy dzielą jeden klucz "unknown" —
   para IP + e-mail działa wtedy jak limit per konto z niskim progiem. */
/**
 * Źródło próby: IPv4 bez zmian, IPv6 przycięte do /64 — jeden abonent dostaje całą pulę /64,
 * więc per-adres miałby miliardy świeżych liczników. Dowolny inny string z nagłówka → "unknown",
 * inaczej dawałby nieskończenie wiele par i długie klucze.
 */
export function ipSource(ip: string | null): string {
  if (!ip) return "unknown";
  const version = isIP(ip);
  if (version === 4) return ip;
  if (version !== 6) return "unknown";
  const address = ip.split("%")[0].toLowerCase(); // bez strefy (fe80::1%eth0)
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if (mapped) return mapped[1];
  const groups = (part: string) =>
    part ? part.split(":").flatMap((group) => (group.includes(".") ? ["0", "0"] : [group])) : [];
  const [head, tail] = address.split("::");
  const left = groups(head);
  const right = tail === undefined ? [] : groups(tail);
  const full = [...left, ...Array<string>(8 - left.length - right.length).fill("0"), ...right];
  return `${full.slice(0, 4).map((group) => Number.parseInt(group, 16).toString(16)).join(":")}::/64`;
}

function keys(email: string, ip: string | null) {
  const account = normalize(email);
  return { pair: `pair:${ipSource(ip)}|${account}`, account: `email:${account}` };
}

function live(key: string, now: number): Entry | undefined {
  const entry = entries.get(key);
  return entry && entry.resetAt > now ? entry : undefined;
}

function bump(key: string, now: number): void {
  const entry = live(key, now);
  if (entry) {
    entry.attempts += 1;
    return;
  }
  if (entries.size >= MAX_TRACKED) {
    for (const [name, old] of entries) if (old.resetAt <= now) entries.delete(name);
    // ponytail: pod zalewem aktywnych wpisów wypada najstarszy — jego blokada znika wcześniej; Redis z TTL to naprawia.
    if (entries.size >= MAX_TRACKED) entries.delete(entries.keys().next().value!);
  }
  entries.set(key, { attempts: 1, resetAt: now + LOGIN_WINDOW_MS });
}

/**
 * Rezerwuje próbę logowania *przed* wysłaniem hasła do backendu — licząc dopiero porażki,
 * paczka równoległych żądań przeszłaby cała, zanim pierwsza wróci z 401.
 * Zwraca sekundy do odblokowania albo `null`, gdy próba może pójść dalej.
 */
export function takeLoginAttempt(email: string, ip: string | null, now = Date.now()): number | null {
  const { pair, account } = keys(email, ip);
  const limits: [string, number][] = [
    [pair, MAX_ATTEMPTS_PER_IP_EMAIL],
    [account, MAX_ATTEMPTS_PER_EMAIL],
  ];
  const blocked = limits
    .map(([key, max]) => ({ entry: live(key, now), max }))
    .filter(({ entry, max }) => entry && entry.attempts >= max)
    .map(({ entry }) => entry!.resetAt);
  if (blocked.length) return Math.ceil((Math.max(...blocked) - now) / 1000);
  bump(pair, now);
  bump(account, now);
  return null;
}

/* Sukces zeruje tylko parę IP + e-mail. Licznik konta wygasa sam — inaczej każde logowanie
   właściciela dawałoby rozproszonemu atakowi kolejne 50 prób. */
export function clearLoginAttempts(email: string, ip: string | null): void {
  entries.delete(keys(email, ip).pair);
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Reguła hasła (NIST 800-63B: długość zamiast wymogów na znaki specjalne). Liczy znaki jak Python, nie jednostki UTF-16. */
export function isAcceptablePassword(password: unknown): boolean {
  if (typeof password !== "string") return false;
  const length = [...password].length;
  return length >= PASSWORD_MIN && length <= PASSWORD_MAX;
}
