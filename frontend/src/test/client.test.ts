import { describe, expect, it } from "vitest";
import { delay, http, HttpResponse } from "msw";
import {
  API_URL,
  api,
  clearSession,
  hasSession,
  logout,
  setSession,
} from "@/lib/api/client";
import { teacherApi } from "@/lib/api/teacher";
import { server } from "./server";
import { session, summary, teacher } from "./fixtures";

describe("Central API client", () => {
  it("single-flights refresh for parallel 401s and sends rotated bearer token", async () => {
    let refreshes = 0;
    setSession(session);
    server.use(
      http.get(`${API_URL}/auth/me`, ({ request }) =>
        request.headers.get("Authorization") === "Bearer access-2"
          ? HttpResponse.json(teacher)
          : new HttpResponse(null, { status: 401 }),
      ),
      http.post(`${API_URL}/auth/refresh`, async () => {
        refreshes++;
        await delay(30);
        return HttpResponse.json({
          ...session,
          access_token: "access-2",
          refresh_token: "refresh-2",
        });
      }),
    );
    const result = await Promise.all([
      api("/auth/me"),
      api("/auth/me"),
      api("/auth/me"),
    ]);
    expect(result).toEqual([teacher, teacher, teacher]);
    expect(refreshes).toBe(1);
  });
  it("clears the session after refresh is rejected", async () => {
    setSession(session);
    server.use(
      http.get(
        `${API_URL}/auth/me`,
        () => new HttpResponse(null, { status: 401 }),
      ),
      http.post(`${API_URL}/auth/refresh`, () =>
        HttpResponse.json(
          { error: { code: "EXPIRED", message: "Session expired." } },
          { status: 401 },
        ),
      ),
    );
    await expect(api("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(hasSession()).toBe(false);
  });
  it("preserves a session on transient refresh/network failure", async () => {
    setSession(session);
    server.use(
      http.get(
        `${API_URL}/auth/me`,
        () => new HttpResponse(null, { status: 401 }),
      ),
      http.post(`${API_URL}/auth/refresh`, () => HttpResponse.error()),
    );
    await expect(api("/auth/me")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    expect(hasSession()).toBe(true);
  });
  it("does not refresh or transform a forbidden response into an authorized result", async () => {
    let refreshes = 0;
    setSession(session);
    server.use(
      http.get(
        `${API_URL}/auth/me`,
        () => new HttpResponse(null, { status: 403 }),
      ),
      http.post(`${API_URL}/auth/refresh`, () => {
        refreshes++;
        return HttpResponse.json(session);
      }),
    );
    await expect(api("/auth/me")).rejects.toMatchObject({ status: 403 });
    expect(refreshes).toBe(0);
  });
  it("does not restore a logged-out session when an in-flight refresh finishes", async () => {
    let started!: () => void;
    const refreshStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let finish!: () => void;
    const finishRefresh = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const revoked: unknown[] = [];
    setSession(session);
    server.use(
      http.get(
        `${API_URL}/auth/me`,
        () => new HttpResponse(null, { status: 401 }),
      ),
      http.post(`${API_URL}/auth/refresh`, async () => {
        started();
        await finishRefresh;
        return HttpResponse.json({
          ...session,
          access_token: "rotated",
          refresh_token: "rotated-refresh",
        });
      }),
      http.post(`${API_URL}/auth/logout`, async ({ request }) => {
        revoked.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const pending = api("/auth/me");
    const rejected = expect(pending).rejects.toMatchObject({
      code: "SESSION_CHANGED",
    });
    await refreshStarted;
    await logout();
    finish();
    await rejected;
    expect(hasSession()).toBe(false);
    expect(revoked).toContainEqual({ refresh_token: "rotated-refresh" });
  });
  it("rejects late responses after account switch and supports cancellation", async () => {
    setSession(session);
    server.use(
      http.get(`${API_URL}/auth/me`, async () => {
        await delay(80);
        return HttpResponse.json(teacher);
      }),
    );
    const pending = api("/auth/me");
    clearSession();
    setSession({ access_token: "new-account", refresh_token: "new-refresh" });
    await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    const abort = new AbortController();
    const canceled = api("/auth/me", { signal: abort.signal });
    abort.abort();
    await expect(canceled).rejects.toMatchObject({ name: "AbortError" });
  });
  it("loads every summary page before returning counts and preserves snapshot date", async () => {
    const offsets: number[] = [];
    let historicalDate: string | null = null;
    const many = Array.from({ length: 201 }, (_, i) => ({
      ...summary.students[0],
      student_id: `s-${i}`,
    }));
    setSession(session);
    server.use(
      http.get(`${API_URL}/teacher/classes/:id/risk-summary`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        const offset = Number(query.get("offset"));
        offsets.push(offset);
        if (offset) historicalDate = query.get("as_of_date");
        return HttpResponse.json({
          ...summary,
          counts: { ...summary.counts, students: 201 },
          students: many.slice(offset, offset + 200),
          offset,
        });
      }),
    );
    const result = await teacherApi.summary("course-1", "attention");
    expect(result.students).toHaveLength(201);
    expect(offsets).toEqual([0, 200]);
    expect(historicalDate).toBe("2026-10-03");
  });
  it("reports an inconsistent paginated roster instead of showing a partial class", async () => {
    setSession(session);
    server.use(
      http.get(`${API_URL}/teacher/classes/:id/risk-summary`, ({ request }) =>
        HttpResponse.json({
          ...summary,
          counts: { ...summary.counts, students: 4 },
          students:
            new URL(request.url).searchParams.get("offset") === "0"
              ? summary.students
              : [],
        }),
      ),
    );
    await expect(
      teacherApi.summary("course-1", "attention"),
    ).rejects.toMatchObject({ code: "ROSTER_CHANGED" });
  });
});
