"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowUpIcon,
  FileIcon,
  ImageIcon,
  MicIcon,
  PaperclipIcon,
  XIcon,
} from "./Icons";
import styles from "./Composer.module.css";
import type { Attachment } from "@/lib/types";

type ComposerProps = {
  value: string;
  onValueChange: (value: string) => void;
  attachments: Attachment[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onSend: () => void;
  listening: boolean;
  onToggleListening: () => void;
};

export function Composer({
  value,
  onValueChange,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  onSend,
  listening,
  onToggleListening,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragDepth, setDragDepth] = useState(0);

  // auto-grow — pole rośnie z treścią, do maks. wysokości z CSS
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const resize = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [value]);

  const canSend = value.trim().length > 0 || attachments.length > 0;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSend();
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) onAddFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragDepth(0);
      if (event.dataTransfer.files?.length) onAddFiles(event.dataTransfer.files);
    },
    [onAddFiles],
  );

  return (
    <div
      className={`${styles.card} ${dragDepth > 0 ? styles.dragging : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragDepth((d) => d + 1);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setDragDepth((d) => Math.max(0, d - 1))}
      onDrop={handleDrop}
    >
      {attachments.length > 0 && (
        <ul className={styles.attachments}>
          {attachments.map((file) => (
            <li key={file.id} className={styles.chip}>
              <span className={file.kind === "image" ? styles.chipImg : styles.chipPdf}>
                {file.kind === "image" ? <ImageIcon size={15} /> : <FileIcon size={15} />}
              </span>
              <span className={styles.chipName} title={file.name}>
                {file.name}
              </span>
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => onRemoveAttachment(file.id)}
                aria-label={`Usuń załącznik ${file.name}`}
              >
                <XIcon size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className={styles.srOnly} htmlFor="gw-question">
        Twoje pytanie
      </label>
      <textarea
        id="gw-question"
        ref={textareaRef}
        className={styles.input}
        rows={1}
        value={value}
        placeholder="Jak wygląda procedura obrony inżynierki?"
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <div className={styles.actions}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
          className={styles.srOnly}
          onChange={handleFileInput}
        />
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Załącz plik"
        >
          <PaperclipIcon />
        </button>
        <button
          type="button"
          className={`${styles.iconButton} ${listening ? styles.listening : ""}`}
          onClick={onToggleListening}
          aria-pressed={listening}
          aria-label={listening ? "Zatrzymaj dyktowanie" : "Zadaj pytanie głosem"}
        >
          <MicIcon />
        </button>

        <p className={styles.hint}>
          {listening ? "Słucham…" : "PDF, DOCX, PNG — do 20 MB"}
        </p>

        <button
          type="button"
          className={styles.send}
          onClick={onSend}
          disabled={!canSend}
          aria-label="Wyślij pytanie"
        >
          <ArrowUpIcon size={20} />
        </button>
      </div>

      {dragDepth > 0 && <div className={styles.dropHint}>Upuść pliki, żeby je załączyć</div>}
    </div>
  );
}
