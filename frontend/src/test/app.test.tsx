import { describe, expect, it } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { API_URL, setSession, hasSession } from "@/lib/api/client";
import { server } from "./server";
import { course, session, summary, teacher } from "./fixtures";
import { renderApp } from "./render";

describe("Authentication and role routing", () => {
  it("redirects unauthenticated access and validates the login form", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(
      await screen.findByRole("button", { name: "Sign in to EduGuard" }),
    );
    expect(await screen.findByText("Enter your school code.")).toBeVisible();
    expect(screen.getByText("Enter a valid email address.")).toBeVisible();
    expect(screen.getByText("Enter your password.")).toBeVisible();
  });
  it("submits school-scoped credentials and shows teacher dashboard", async () => {
    const user = userEvent.setup();
    let payload: unknown;
    server.use(
      http.post(`${API_URL}/auth/login`, async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json(session);
      }),
    );
    renderApp("/login");
    await user.type(await screen.findByLabelText("School code"), "demo");
    await user.type(
      screen.getByLabelText("Email address"),
      "teacher@example.test",
    );
    await user.type(screen.getByLabelText("Password"), "demo-password");
    await user.click(
      screen.getByRole("button", { name: "Sign in to EduGuard" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Hello, Maya." }),
    ).toBeVisible();
    expect(payload).toEqual({
      school_slug: "demo",
      email: "teacher@example.test",
      password: "demo-password",
    });
  });
  it("shows server login errors without navigating", async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json(
          {
            error: {
              code: "INVALID_CREDENTIALS",
              message: "Invalid credentials.",
            },
          },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp("/login");
    await user.type(await screen.findByLabelText("School code"), "demo");
    await user.type(screen.getByLabelText("Email address"), "a@b.test");
    await user.type(screen.getByLabelText("Password"), "incorrect");
    await user.click(
      screen.getByRole("button", { name: "Sign in to EduGuard" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid credentials.",
    );
  });
  it.each(["student", "school_admin"] as const)(
    "restores %s session and denies teacher routes without fetching teacher data",
    async (role) => {
      let teacherCalls = 0;
      setSession(session);
      server.use(
        http.get(`${API_URL}/auth/me`, () =>
          HttpResponse.json({ ...teacher, role }),
        ),
        http.get(`${API_URL}/teacher/classes`, () => {
          teacherCalls++;
          return HttpResponse.json([course]);
        }),
      );
      renderApp();
      expect(
        await screen.findByRole("heading", {
          name:
            role === "student"
              ? "You’ve got this, Maya."
              : "A school ready to grow.",
        }),
      ).toBeVisible();
      expect(teacherCalls).toBe(0);
      expect(
        screen.queryByText(/risk_probability|at_risk|private teacher notes/i),
      ).not.toBeInTheDocument();
    },
  );
  it("restores a teacher session and clears all cached data at logout", async () => {
    setSession(session);
    const user = userEvent.setup();
    const { client } = renderApp();
    await screen.findByText("Riya Patel");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(hasSession()).toBe(false);
    expect(client.getQueriesData({ queryKey: ["teacher"] })).toEqual([]);
  });
  it("refreshes an expired access token while restoring a session", async () => {
    setSession(session);
    server.use(
      http.get(`${API_URL}/auth/me`, ({ request }) =>
        request.headers.get("Authorization") === "Bearer access-2"
          ? HttpResponse.json(teacher)
          : new HttpResponse(null, { status: 401 }),
      ),
    );
    renderApp();
    expect(await screen.findByText("Riya Patel")).toBeVisible();
  });
});

describe("Teacher foundation", () => {
  it("renders live summary fields, missing metrics and source explanation", async () => {
    setSession(session);
    renderApp();
    expect(
      await screen.findByText("Attendance decreased by 9.2 percentage points."),
    ).toBeVisible();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Priority Support")).toBeVisible();
    expect(within(table).getByText("78%")).toBeVisible();
    expect(within(table).getByText("More history needed")).toBeVisible();
    expect(
      within(table).getByLabelText("Attendance not available"),
    ).toHaveTextContent("—");
    expect(screen.getByText("Students with an open plan")).toBeVisible();
  });
  it("combines support, search, trend, and intervention filters", async () => {
    setSession(session);
    const user = userEvent.setup();
    renderApp();
    await screen.findByText("Riya Patel");
    await user.click(
      screen.getByRole("button", { name: "Priority Support 1" }),
    );
    expect(screen.queryByText("Arjun Shah")).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText("Filter by trend"),
      "declining",
    );
    await user.selectOptions(
      screen.getByLabelText("Filter by intervention"),
      "active",
    );
    await user.type(screen.getByLabelText("Search students"), "10A-01");
    expect(screen.getByText("Riya Patel")).toBeVisible();
    await user.type(screen.getByLabelText("Search students"), "no-match");
    expect(screen.getByText("No students match these filters")).toBeVisible();
  });
  it("uses server ordering and changes course without stale summary data", async () => {
    const requests: string[] = [];
    server.use(
      http.get(`${API_URL}/teacher/classes`, () =>
        HttpResponse.json([course, { ...course, id: "course-2" }]),
      ),
      http.get(
        `${API_URL}/teacher/classes/:id/risk-summary`,
        ({ params, request }) => {
          requests.push(
            `${params.id}:${new URL(request.url).searchParams.get("sort")}`,
          );
          return HttpResponse.json({
            ...summary,
            students:
              params.id === "course-2"
                ? [{ ...summary.students[1], name: "Second course student" }]
                : summary.students,
            counts: {
              ...summary.counts,
              students: params.id === "course-2" ? 1 : 3,
            },
          });
        },
      ),
    );
    setSession(session);
    const user = userEvent.setup();
    renderApp();
    await screen.findByText("Riya Patel");
    await user.selectOptions(screen.getByLabelText("Sort students"), "score");
    await waitFor(() => expect(requests).toContain("course-1:score"));
    await user.selectOptions(
      screen.getByLabelText("Your class & subject"),
      "course-2",
    );
    expect(await screen.findByText("Second course student")).toBeVisible();
    expect(screen.queryByText("Riya Patel")).not.toBeInTheDocument();
  });
  it("shows class loading, empty enrollment, and no assigned class states", async () => {
    server.use(
      http.get(`${API_URL}/teacher/classes`, async () => {
        await delay(80);
        return HttpResponse.json([]);
      }),
    );
    setSession(session);
    renderApp();
    expect(
      await screen.findByRole("status", { name: "Loading assigned classes" }),
    ).toBeVisible();
    expect(
      await screen.findByText("Your classes will appear here"),
    ).toBeVisible();
  });
  it("shows an empty roster without fabricated zero-valued metrics", async () => {
    server.use(
      http.get(`${API_URL}/teacher/classes/:id/risk-summary`, () =>
        HttpResponse.json({
          ...summary,
          students: [],
          counts: {
            students: 0,
            priority_support: 0,
            watch: 0,
            doing_well: 0,
            not_assessed: 0,
            newly_declining: 0,
          },
        }),
      ),
    );
    setSession(session);
    renderApp();
    expect(await screen.findByText("No students enrolled yet")).toBeVisible();
  });
  it("recovers from a failed summary with retry", async () => {
    server.use(
      http.get(`${API_URL}/teacher/classes/:id/risk-summary`, () =>
        HttpResponse.json(
          { error: { message: "Summary is unavailable." } },
          { status: 503 },
        ),
      ),
    );
    setSession(session);
    const user = userEvent.setup();
    renderApp();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Summary is unavailable.",
    );
    server.use(
      http.get(`${API_URL}/teacher/classes/:id/risk-summary`, () =>
        HttpResponse.json(summary),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Riya Patel")).toBeVisible();
  });
  it("opens student detail with course context", async () => {
    setSession(session);
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole("link", { name: /Riya Patel/ }));
    expect(
      await screen.findByRole("heading", { name: "Riya Patel" }),
    ).toBeVisible();
    expect(screen.getByText("Roll number 10A-01 · Grade 10")).toBeVisible();
    expect(screen.getByLabelText("Course context")).toHaveValue("course-1");
  });
  it("respects backend denials for unassigned students", async () => {
    server.use(
      http.get(`${API_URL}/teacher/students/:id`, () =>
        HttpResponse.json(
          { error: { message: "Student not found." } },
          { status: 404 },
        ),
      ),
    );
    setSession(session);
    renderApp("/teacher/students/other-student");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Student not found.",
    );
    expect(screen.queryByText("Riya Patel")).not.toBeInTheDocument();
  });
  it("renders class list and assigned roster", async () => {
    setSession(session);
    const user = userEvent.setup();
    renderApp("/teacher/classes");
    await user.click(
      await screen.findByRole("link", { name: /View students/ }),
    );
    expect(await screen.findByText("Riya Patel")).toBeVisible();
  });
});
