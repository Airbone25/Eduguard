import type { Session, Tokens } from "@/types/api";

export const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1"
).replace(/\/$/, "");
const STORAGE_KEY = "eduguard.session";
let tokens: Tokens | null = readTokens();
let epoch = 0;
let refreshPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function readTokens(): Tokens | null {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) || "null",
    );
    if (
      value &&
      typeof value === "object" &&
      "access_token" in value &&
      "refresh_token" in value &&
      typeof value.access_token === "string" &&
      typeof value.refresh_token === "string"
    ) {
      return {
        access_token: value.access_token,
        refresh_token: value.refresh_token,
      };
    }
  } catch {
    /* A blocked browser store falls back to an in-memory session. */
  }
  return null;
}
function saveTokens(value: Tokens | null) {
  tokens = value;
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* In-memory login still works when browser storage is unavailable. */
  }
}
export function setSession(value: Tokens) {
  epoch++;
  saveTokens({
    access_token: value.access_token,
    refresh_token: value.refresh_token,
  });
}
export function clearSession() {
  epoch++;
  saveTokens(null);
  listeners.forEach((listener) => listener());
}
export function hasSession() {
  return tokens !== null;
}
export function onSessionExpired(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
async function decode<T>(response: Response): Promise<T> {
  if (response.ok)
    return response.status === 204
      ? (undefined as T)
      : (response.json() as Promise<T>);
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  throw new ApiError(
    response.status,
    body?.error?.code || "REQUEST_FAILED",
    body?.error?.message ||
      "The request could not be completed. Please try again.",
  );
}
async function send(
  path: string,
  options: RequestInit,
  token?: string,
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  try {
    return await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (error) {
    if (
      options.signal?.aborted ||
      (error instanceof DOMException && error.name === "AbortError")
    )
      throw error;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "We could not connect to EduGuard. Check your connection and try again.",
    );
  }
}
async function refresh(): Promise<void> {
  if (!refreshPromise) {
    const startEpoch = epoch;
    const current = tokens;
    if (!current)
      throw new ApiError(401, "NO_SESSION", "Please sign in to continue.");
    const task = (async () => {
      try {
        const session = await decode<Session>(
          await send("/auth/refresh", {
            method: "POST",
            body: JSON.stringify({ refresh_token: current.refresh_token }),
          }),
        );
        if (epoch !== startEpoch) {
          // Logout can happen while rotation is in flight. Revoke the newly rotated session too.
          await send(
            "/auth/logout",
            {
              method: "POST",
              body: JSON.stringify({ refresh_token: session.refresh_token }),
            },
            session.access_token,
          ).catch(() => undefined);
          throw new ApiError(
            401,
            "SESSION_CHANGED",
            "Please sign in to continue.",
          );
        }
        saveTokens({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
      } catch (error) {
        if (
          epoch === startEpoch &&
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        )
          clearSession();
        throw error;
      }
    })();
    refreshPromise = task;
    void task
      .finally(() => {
        if (refreshPromise === task) refreshPromise = null;
      })
      .catch(() => undefined);
  }
  return refreshPromise;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const startEpoch = epoch;
  const usedToken = tokens?.access_token;
  if (authenticated && !usedToken)
    throw new ApiError(401, "NO_SESSION", "Please sign in to continue.");
  let response = await send(
    path,
    options,
    authenticated ? usedToken : undefined,
  );
  if (authenticated && startEpoch !== epoch)
    throw new ApiError(401, "SESSION_CHANGED", "Your session has changed.");
  if (authenticated && response.status === 401) {
    // Another request may have already refreshed after this request was sent.
    if (tokens?.access_token === usedToken) await refresh();
    options.signal?.throwIfAborted();
    if (!tokens || startEpoch !== epoch)
      throw new ApiError(401, "NO_SESSION", "Please sign in to continue.");
    response = await send(path, options, tokens.access_token);
    if (startEpoch !== epoch)
      throw new ApiError(401, "SESSION_CHANGED", "Your session has changed.");
    if (response.status === 401) clearSession();
  }
  return decode<T>(response);
}
export async function logout() {
  const current = tokens;
  clearSession();
  if (current)
    await decode<void>(
      await send(
        "/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: current.refresh_token }),
        },
        current.access_token,
      ),
    );
}
