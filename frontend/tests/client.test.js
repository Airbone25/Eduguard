import test from "node:test";
import assert from "node:assert/strict";
import {
  api,
  setSession,
  clearSession,
  createDemoSession,
  ApiError,
} from "../src/lib/api/client.js";
const originalFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  clearSession();
});
test("a rejected school sign-in stays an error instead of authenticating a demo", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Check your credentials",
        },
      }),
      { status: 401 },
    );
  await assert.rejects(
    api("/auth/login", { method: "POST", body: "{}" }, false),
    (e) => e instanceof ApiError && e.status === 401,
  );
});
test("an offline school workspace reports a recoverable connection error", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(
    api("/teacher/classes"),
    (e) => e.code === "NETWORK_ERROR",
  );
});
test("explicit demo reads work offline and support paginated URLs", async () => {
  globalThis.fetch = async () => {
    throw new Error("Demo must not contact server");
  };
  setSession(createDemoSession("teacher@demo.edu"));
  assert.equal((await api("/teacher/classes?limit=200&offset=0")).length, 3);
  assert.equal(
    (await api("/teacher/classes/crs-001/students?limit=200&offset=0")).length,
    5,
  );
});
test("demo filters do not repeat a different class or student’s records", async () => {
  setSession(createDemoSession("teacher@demo.edu"));
  assert.equal(
    (await api("/teacher/classes/crs-002/risk-summary")).students.length,
    0,
  );
  assert.equal(
    (await api("/teacher/interventions?status=completed")).length,
    0,
  );
  assert.equal((await api("/teacher/students/stu-102/predictions")).length, 0);
});
test("demo mutations report read-only status instead of pretending to save", async () => {
  setSession(createDemoSession("teacher@demo.edu"));
  await assert.rejects(
    api("/teacher/weekly-records", { method: "POST", body: "{}" }),
    (e) => e.code === "DEMO_READ_ONLY",
  );
});
test("student demo responses exclude teacher risk fields and endpoints", async () => {
  setSession(createDemoSession("student@demo.edu"));
  const output = JSON.stringify(await api("/student/me/dashboard"));
  for (const field of [
    "risk_probability",
    "support_level",
    "contributions",
    "severity",
  ])
    assert.ok(!output.includes(field));
  await assert.rejects(api("/teacher/alerts"), (e) => e.status === 403);
});
test("successful real requests preserve their payload and bearer authorization", async () => {
  setSession({ access_token: "test-token", refresh_token: "test-refresh" });
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.get("Authorization"), "Bearer test-token");
    assert.equal(options.headers.get("Content-Type"), "application/json");
    assert.equal(options.body, '{"records":[]}');
    return new Response(JSON.stringify({ saved: 1 }), { status: 200 });
  };
  assert.deepEqual(
    await api("/teacher/weekly-records", {
      method: "POST",
      body: '{"records":[]}',
    }),
    { saved: 1 },
  );
});
