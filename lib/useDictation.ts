"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

/**
 * Dyktowanie pytania przez Web Speech API. Tam, gdzie API nie ma
 * (Firefox, Safari < 16), przycisk mikrofonu tylko zmienia stan wizualny.
 */
export function useDictation(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const callbackRef = useRef(onTranscript);

  useEffect(() => {
    callbackRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    const w = window as SpeechWindow;
    const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = "pl-PL";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      callbackRef.current(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.stop();
    };
  }, []);

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current;
    setListening((wasListening) => {
      if (recognition) {
        if (wasListening) recognition.stop();
        else recognition.start();
      }
      return !wasListening;
    });
  }, []);

  return { listening, toggle };
}
