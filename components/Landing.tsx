"use client";

import Image from "next/image";
import { startTransition, useCallback, useState } from "react";
import { AuthOverlay } from "./auth/AuthOverlay";
import { ChatThread } from "./ChatThread";
import { Composer } from "./Composer";
import { QuotaNotice } from "./QuotaNotice";
import { HeartIcon } from "./Icons";
import { Scene } from "./Scene";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { SUGGESTIONS } from "@/lib/data";
import { useAuth } from "@/lib/useAuth";
import { useChat } from "@/lib/useChat";
import { useQuotaLock } from "@/lib/quotaLock";
import { useDictation } from "@/lib/useDictation";
import type { Attachment } from "@/lib/types";
import styles from "./Landing.module.css";
import sceneStyles from "./Scene.module.css";

/** Ile pierwsze pytanie czeka na szybką odmowę serwera, zanim scena wejdzie w tryb rozmowy. */
const FIRST_SEND_HOLD_MS = 250;

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "avif"];

function toAttachment(file: File): Attachment {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    kind: IMAGE_EXTENSIONS.includes(extension) ? "image" : "file",
  };
}

export function Landing() {
  const [question, setQuestion] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  /** Przycisk, z którego rozwinął się ekran logowania; `null` — ekran zamknięty. */
  const [authTrigger, setAuthTrigger] = useState<HTMLElement | null>(null);

  const auth = useAuth();
  const email = auth.status === "authenticated" ? auth.email : null;

  const chat = useChat();
  /** Limit pytań wyczerpany — do kiedy (epoch ms); `null`, gdy okienko otwarte. */
  const lockedUntil = useQuotaLock();
  /* Przy pierwszym pytaniu scena chwilę wstrzymuje wejście w tryb rozmowy: odmowa (np. 429,
     gdy limit wyczerpano na innym urządzeniu) przychodzi w kilkadziesiąt ms i wtedy scena
     w ogóle nie rusza, zamiast wskoczyć w rozmowę i od razu z niej wyskoczyć. */
  const [holdLanding, setHoldLanding] = useState(false);
  const hasConversation = (chat.messages.length > 0 || chat.pending) && !holdLanding;
  const { listening, toggle: toggleListening } = useDictation(setQuestion);

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files).map(toAttachment);
    setAttachments((current) => {
      const known = new Set(current.map((file) => file.id));
      return [...current, ...incoming.filter((file) => !known.has(file.id))];
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => current.filter((file) => file.id !== id));
  }, []);

  const handleSend = async () => {
    // okienko zamknięte — pytanie nie leci na serwer, więc scena nie mignie wejściem w rozmowę
    if (lockedUntil !== null) return;
    const text = question;
    setQuestion("");

    if (hasConversation) {
      if (!(await chat.send(text))) setQuestion(text);
      return;
    }

    setHoldLanding(true);
    const sent = chat.send(text);
    const early = await Promise.race([
      sent,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), FIRST_SEND_HOLD_MS)),
    ]);
    // Wejście w rozmowę w transition — okienko i pole pytania przejeżdżają (ViewTransition w Scene).
    // Szybka odmowa (early === false) zdejmuje wstrzymanie w tym samym transition co cofnięcie pytania.
    startTransition(() => setHoldLanding(false));
    if (early === false || !(await sent)) setQuestion(text);
  };


  const startNewChat = () => {
    startTransition(() => {
      chat.reset();
      setQuestion("");
      setAttachments([]);
      setStatus(null);
      setDrawerOpen(false);
    });
  };

  const openLogin = (trigger: HTMLElement) => {
    setStatus(null);
    setAuthTrigger(trigger);
  };

  const closeLogin = useCallback(() => setAuthTrigger(null), []);

  return (
    <div className={styles.shell}>
      <Sidebar
        activeId={chat.sessionId}
        onSelect={() => setDrawerOpen(false)}
        onNewChat={startNewChat}
        onLogin={openLogin}
        onLogout={() => void auth.logout()}
        email={email}
        isAuthenticated={auth.status !== "anonymous"}
        isDrawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      <div className={styles.main}>
        <Topbar
          showLogin={auth.status === "anonymous"}
          lockedUntil={lockedUntil}
          onLogin={openLogin}
          onOpenDrawer={() => setDrawerOpen(true)}
        />

        <div className={styles.scroll}>
          <Scene
            closed={lockedUntil !== null}
            conversation={
              hasConversation ? (
                <ChatThread messages={chat.messages} pending={chat.pending} error={lockedUntil === null ? chat.error : null} />
              ) : undefined
            }
            below={
              <>
                {lockedUntil !== null && (
                  <QuotaNotice lockedUntil={lockedUntil} onLogin={email ? undefined : openLogin} />
                )}

                {/* przy zamkniętym okienku błąd limitu mówi już QuotaNotice */}
                {!hasConversation && lockedUntil === null && (status ?? chat.error) && (
                  <p className={styles.status} role="status">
                    {status ?? chat.error}
                  </p>
                )}

                {!hasConversation && (
                  <div className={styles.suggestions}>
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className={styles.suggestion}
                        onClick={() => setQuestion(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                <p className={sceneStyles.trust}>
                  Odpowiedzi zawierają odnośniki do regulaminów i uchwał PWR · zawsze sprawdź źródło
                </p>

                {!hasConversation && (
                  <footer className={styles.footer}>
                    Made with
                    <span className={styles.heart}>
                      <HeartIcon size={13} />
                    </span>
                    by
                    <Image
                      className={styles.solvroMark}
                      src="/brand/solvro-mark.png"
                      alt=""
                      width={124}
                      height={96}
                    />
                    KN Solvro © 2026
                  </footer>
                )}
              </>
            }
          >
            <Composer
              value={question}
              onValueChange={setQuestion}
              attachments={attachments}
              onAddFiles={addFiles}
              onRemoveAttachment={removeAttachment}
              onSend={handleSend}
              listening={listening}
              onToggleListening={toggleListening}
              disabled={chat.pending || lockedUntil !== null}
              disabledHint={lockedUntil !== null ? "Limit pytań wyczerpany" : undefined}
              attachmentsEnabled={false}
            />
          </Scene>
        </div>
      </div>

      {authTrigger && <AuthOverlay trigger={authTrigger} onClosed={closeLogin} />}
    </div>
  );
}
