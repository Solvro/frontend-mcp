"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api/client";
import { ApiError } from "./api/problem";
import { groupConversations } from "./history";
import type { ConversationGroup } from "./types";

/**
 * Historia rozmów do sidebara. `/api/users/me/sessions` wymaga konta, więc anonimowy
 * tryb ma pustą listę — jego rozmowy backend trzyma z `user_id: null` i nie wydaje ich.
 *
 * Błąd pobrania jest cichy: historia to dodatek obok czatu, a nie warunek zadania pytania.
 * Wyjątek to 401 — sesja wygasła (np. wylogowanie na innym urządzeniu), więc UI ma
 * przejść w tryb anonimowy, zamiast udawać zalogowanego z pustą listą.
 */
export function useConversations(enabled: boolean, onUnauthorized?: () => void) {
  const [groups, setGroups] = useState<ConversationGroup[]>([]);
  /* Odświeżenie to bump licznika, a nie drugie miejsce, które pobiera listę — jedno
     żądanie w efekcie, z flagą `cancelled`, jak w `useAuth`. */
  const [nonce, setNonce] = useState(0);
  const unauthorizedRef = useRef(onUnauthorized);
  useEffect(() => {
    unauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api
      .listSessions()
      .then((items) => {
        if (!cancelled) setGroups(groupConversations(items));
      })
      .catch((cause: unknown) => {
        if (!cancelled && cause instanceof ApiError && cause.status === 401) unauthorizedRef.current?.();
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, nonce]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  // Po wylogowaniu lista znika od razu, bez czekania na żądanie, które i tak wróci 401.
  return { groups: enabled ? groups : [], refresh };
}
