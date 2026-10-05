import { useEffect, useState, type PropsWithChildren } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthContext } from "@/features/auth/context";
import { authApi } from "@/lib/api/auth";
import {
  clearSession,
  hasSession,
  logout,
  onSessionExpired,
  setSession,
} from "@/lib/api/client";
import { useUiStore } from "@/stores/uiStore";

export function AuthProvider({ children }: PropsWithChildren) {
  const client = useQueryClient();
  const [enabled, setEnabled] = useState(hasSession);
  const [logoutWarning, setLogoutWarning] = useState<string | null>(null);
  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: ({ signal }) => authApi.me(signal),
    enabled,
    retry: false,
  });
  useEffect(
    () =>
      onSessionExpired(() => {
        setEnabled(false);
        client.clear();
        useUiStore.getState().reset();
      }),
    [client],
  );
  return (
    <AuthContext.Provider
      value={{
        user: enabled ? (me.data ?? null) : null,
        pending: enabled && me.isPending,
        error: enabled ? me.error : null,
        logoutWarning,
        retry: () => {
          void me.refetch();
        },
        signIn: async (input) => {
          setLogoutWarning(null);
          clearSession();
          const session = await authApi.login(input);
          setSession(session);
          client.setQueryData(["auth", "me"], session.user);
          setEnabled(true);
          return session.user;
        },
        signOut: async () => {
          try {
            await logout();
          } catch {
            setLogoutWarning(
              "You are signed out on this device. The server could not confirm session revocation; the session will expire automatically.",
            );
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
