"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api/client";
import { groupConversations } from "./history";
import type { ConversationGroup } from "./types";

/**
 * Historia rozmów do sidebara. `/api/users/me/sessions` wymaga konta, więc anonimowy
 * tryb ma pustą listę — jego rozmowy backend trzyma z `user_id: null` i nie wydaje ich.
 *
 * Błąd pobrania jest cichy: historia to dodatek obok czatu, a nie warunek zadania pytania.
 */
export function useConversations(enabled: boolean) {
  const [groups, setGroups] = useState<ConversationGroup[]>([]);
  /* Odświeżenie to bump licznika, a nie drugie miejsce, które pobiera listę — jedno
     żądanie w efekcie, z flagą `cancelled`, jak w `useAuth`. */
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api
      .listSessions()
      .then((items) => {
        if (!cancelled) setGroups(groupConversations(items));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, nonce]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  // Po wylogowaniu lista znika od razu, bez czekania na żądanie, które i tak wróci 401.
  return { groups: enabled ? groups : [], refresh };
}
