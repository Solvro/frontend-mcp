"use client";

import { useCallback, useState } from "react";
import { ChatThread } from "./ChatThread";
import { Composer } from "./Composer";
import { HeartIcon } from "./Icons";
import { Scene } from "./Scene";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { SUGGESTIONS } from "@/lib/data";
import { useChat } from "@/lib/useChat";
import { useDictation } from "@/lib/useDictation";
import type { Attachment } from "@/lib/types";
import styles from "./Landing.module.css";
import sceneStyles from "./Scene.module.css";

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

  const chat = useChat();
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
    const text = question;
    setQuestion("");
    if (!(await chat.send(text))) setQuestion(text);
  };

  const startNewChat = () => {
    chat.reset();
    setQuestion("");
    setAttachments([]);
    setStatus(null);
    setDrawerOpen(false);
  };

  const handleLogin = () => {
    // TODO(Task 7): dialog logowania.
    setStatus("Logowanie nie jest jeszcze podpięte.");
  };

  const hasConversation = chat.messages.length > 0 || chat.pending;

  return (
    <div className={styles.shell}>
      <Sidebar
        activeId={chat.sessionId}
        onSelect={() => setDrawerOpen(false)}
        onNewChat={startNewChat}
        onLogin={handleLogin}
        isDrawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      <div className={styles.main}>
        <Topbar onLogin={handleLogin} onOpenDrawer={() => setDrawerOpen(true)} />

        <div className={styles.scroll}>
          <Scene
            conversation={
              hasConversation ? (
                <ChatThread messages={chat.messages} pending={chat.pending} error={chat.error} />
              ) : undefined
            }
            below={
              <>
                {!hasConversation && (status ?? chat.error) && (
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

                <footer className={styles.footer}>
                  Made with
                  <span className={styles.heart}>
                    <HeartIcon size={13} />
                  </span>
                  by Solvro © 2026
                </footer>
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
              disabled={chat.pending}
              attachmentsEnabled={false}
            />
          </Scene>
        </div>
      </div>
    </div>
  );
}
