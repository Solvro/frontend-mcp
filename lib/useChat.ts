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
