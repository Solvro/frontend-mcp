"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/* Blokada okienka po wyczerpaniu limitu pytań (dzienny albo minutowy — 429 z backendu).
   Znamy ją z nagłówków odpowiedzi (RateLimit-Remaining / -Reset, Retry-After), więc kolejne
   pytanie nie leci na serwer tylko po to, żeby wrócić z błędem. Zapamiętana w localStorage,
   żeby przeładowanie strony jej nie gubiło. */

const STORAGE_KEY = "gw-locked-until";

let lockedUntil: number | null | undefined; // undefined — jeszcze nie wczytane
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function read(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return value > Date.now() ? value : null;
  } catch {
    return null;
  }
}

function scheduleUnlock() {
  clearTimeout(timer);
  if (lockedUntil) timer = setTimeout(() => setQuotaLock(null), lockedUntil - Date.now());
}

/** `until` — epoch ms, do kiedy okienko jest zamknięte; `null` zdejmuje blokadę. */
export function setQuotaLock(until: number | null) {
  lockedUntil = until !== null && until > Date.now() ? until : null;
  try {
    if (lockedUntil) localStorage.setItem(STORAGE_KEY, String(lockedUntil));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // tryb prywatny — blokada zostaje tylko w pamięci
  }
  scheduleUnlock();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  if (lockedUntil === undefined) {
    lockedUntil = read();
    scheduleUnlock();
  }
  return lockedUntil;
}

/** Epoch ms końca blokady albo `null`, gdy okienko jest otwarte. Na serwerze zawsze `null`. */
export function useQuotaLock(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/** „12 h 40 min”, „7 min”, „42 s” — ile zostało do otwarcia okienka. */
export function formatRemaining(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** Odlicza czas do otwarcia okienka; tyka co sekundę tylko wtedy, gdy jest zamknięte. */
export function useCountdown(until: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [until]);
  return until === null ? null : Math.max(0, until - now);
}
