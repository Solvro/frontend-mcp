"use client";

import { useCallback, useState } from "react";
import { Composer } from "./Composer";
import { HeartIcon } from "./Icons";
import { Scene } from "./Scene";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { SUGGESTIONS } from "@/lib/data";
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

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

  const handleSend = useCallback(() => {
    // TODO: podpiąć POST do API asystenta (MCP + warstwa ML).
    setStatus("Pytanie gotowe do wysłania — API asystenta nie jest jeszcze podpięte.");
  }, []);

  const startNewChat = useCallback(() => {
    setQuestion("");
    setAttachments([]);
    setStatus(null);
    setActiveId(null);
    setDrawerOpen(false);
  }, []);

  const handleLogin = useCallback(() => {
    // TODO: przekierowanie do logowania (USOS / OAuth).
    setStatus("Logowanie nie jest jeszcze podpięte.");
  }, []);

  return (
    <div className={styles.shell}>
      <Sidebar
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id);
          setDrawerOpen(false);
        }}
        onNewChat={startNewChat}
        onLogin={handleLogin}
        isDrawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      <div className={styles.main}>
        <Topbar onLogin={handleLogin} onOpenDrawer={() => setDrawerOpen(true)} />

        <div className={styles.scroll}>
          <Scene
            below={
              <>
                {status && (
                  <p className={styles.status} role="status">
                    {status}
                  </p>
                )}

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
            />
          </Scene>
        </div>
      </div>
    </div>
  );
}
