"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api/client";
import { setQuotaLock } from "./quotaLock";

type AuthStatus = "loading" | "anonymous" | "authenticated";

type AuthContextValue = {
  status: AuthStatus;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** BFF zgłosił wygasłą sesję (401) — przechodzimy w tryb anonimowy. */
  markExpired: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .session()
      .then((session) => {
        if (cancelled) return;
        setStatus(session.authenticated ? "authenticated" : "anonymous");
        setEmail(session.email);
      })
      .catch(() => {
        if (!cancelled) setStatus("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (address: string, password: string) => {
    const session = await api.login(address, password);
    // limit liczy się per konto, a nie per IP — blokada anonimowa już nie obowiązuje
    setQuotaLock(null);
    setStatus("authenticated");
    setEmail(session.email);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setQuotaLock(null);
    setStatus("anonymous");
    setEmail(null);
  }, []);

  const markExpired = useCallback(() => {
    setStatus("anonymous");
    setEmail(null);
  }, []);

  const value = useMemo(
    () => ({ status, email, login, logout, markExpired }),
    [status, email, login, logout, markExpired],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within <AuthProvider>");
  return context;
}
