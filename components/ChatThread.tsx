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
