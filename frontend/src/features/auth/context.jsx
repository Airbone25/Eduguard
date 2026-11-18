import React, { useContext, useEffect, useState } from "react";
import {
  api,
  clearSession,
  onSessionExpired,
  readTokens,
  setSession,
  createDemoSession,
} from "@/lib/api/client";

import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState(null);
  const [logoutWarning, setLogoutWarning] = useState("");

  useEffect(() => {
    const tokens = readTokens();
    if (tokens?.user) {
      setUser(tokens.user);
    }
    setPending(false);

    const unsubscribe = onSessionExpired(() => {
      setUser(null);
      setLogoutWarning("Your session expired. Please sign in again.");
    });
    return unsubscribe;
  }, []);

  const signIn = async ({ school_slug, email, password, demo = false }) => {
    setError(null);
    setLogoutWarning("");
    try {
      const session = demo
        ? createDemoSession(email)
        : await api(
            "/auth/login",
            {
              method: "POST",
              body: JSON.stringify({ school_slug, email, password }),
            },
            false,
          );
      setSession(session);
      setUser(session.user);
      return session.user;
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  const signOut = async () => {
    clearSession();
    setLogoutWarning("");
    setUser(null);
  };

  const value = {
    isDemo: readTokens()?.access_token?.startsWith("mock-") || false,
    user,
    pending,
    error,
    logoutWarning,
    signIn,
    signOut,
    retry: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
