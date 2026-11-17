import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { API_URL, setSession } from "@/lib/api/client";
import { server } from "./server";
import { alertFeed, session } from "./fixtures";
import { renderApp } from "./render";

function predictionFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "prediction-1",
    student_id: "student-1",
    course_offering_id: "course-1",
    as_of_date: "2026-10-01",
    created_at: "2026-10-01T10:00:00Z",
    model_version_id: "model-1",
    model_version: "current-joblib-v1",
    feature_snapshot_id: "snapshot-1",
    feature_version: "weekly-v1",
    risk_probability: 0.55,
    risk_level: "medium",
    at_risk: false,
    support_level: "watch",
    signals: [],
    recommendations: [],
    ...overrides,
  };
}

function progressFixture() {
  return {
    student_id: "student-1",
    as_of_date: "2026-10-03",
    courses: [
      {
        course: {
          id: "course-1",
          classroom_name: "Grade 10-A",
          subject_name: "Mathematics",
          subject_code: "MATH",
          academic_year: "2026",
        },
        attendance: { current: 78, change_4wk: -8, trend: "declining" },
        academic: { current: 61, change_4wk: -10, trend: "declining" },
        assignments: {
          total: 20,
          completed: 12,
          completion_percent: 60,
          on_time_streak_weeks: 2,
        },
        improvements: [],
        weeks: [],
      },
    ],
  };
}

async function feed() {
  return (await screen.findByText("Signals that need your attention"))
    .closest("section") as HTMLElement;
}

describe("AI signal feed", () => {
  it("stays quiet when no signals exist", async () => {
    setSession(session);
    renderApp();
    expect(await screen.findByText("Hello, Maya.")).toBeVisible();
    expect(
      screen.queryByText("Signals that need your attention"),
    ).not.toBeInTheDocument();
  });
  it("shows detected signals with reasons and review links", async () => {
    server.use(
      http.get(`${API_URL}/teacher/alerts`, () => HttpResponse.json(alertFeed)),
    );
    setSession(session);
    renderApp();
    const section = await feed();
    expect(
      within(section).getByText("Risk 55% → 86% (+31 pts)"),
    ).toBeVisible();
    expect(
      within(section).getByText(
        "Participation fell below 40% of opportunities.",
      ),
    ).toBeVisible();
    expect(
      within(section).getByText(
        "Suggested next step: Morning attendance check-in",
      ),
    ).toBeVisible();
    const links = within(section).getAllByRole("link", {
      name: "Review student",
    });
    expect(links[0]).toHaveAttribute(
      "href",
      "/teacher/students/student-1?course=course-1",
    );
  });
  it("filters signals by type", async () => {
    server.use(
      http.get(`${API_URL}/teacher/alerts`, () => HttpResponse.json(alertFeed)),
    );
    setSession(session);
    const user = userEvent.setup();
    renderApp();
    const section = await feed();
    expect(within(section).getByText("Riya Patel")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Recovering 1" }));
    expect(within(section).getByText("Arjun Shah")).toBeVisible();
    expect(within(section).queryByText("Riya Patel")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All signals 2" }));
    expect(within(section).getByText("Riya Patel")).toBeVisible();
  });
});

describe("Risk trajectory", () => {
  it("charts probability across saved insights on the student overview", async () => {
    server.use(
      http.get(
        `${API_URL}/teacher/students/:id/progress`,
        () => HttpResponse.json(progressFixture()),
      ),
      http.get(
        `${API_URL}/teacher/students/:id/predictions`,
        () =>
          HttpResponse.json([
            predictionFixture({
              id: "prediction-2",
              as_of_date: "2026-10-01",
              risk_probability: 0.86,
              risk_level: "high",
              at_risk: true,
              support_level: "priority_support",
            }),
            predictionFixture({
              id: "prediction-1",
              as_of_date: "2026-09-24",
              created_at: "2026-09-24T10:00:00Z",
              risk_probability: 0.55,
            }),
          ]),
      ),
    );
    setSession(session);
    renderApp("/teacher/students/student-1?course=course-1");
    expect(await screen.findByText("Risk trajectory")).toBeVisible();
    expect(
      screen.getByText(/from Sep 24, 2026 to Oct 1, 2026 \(\+31 pts\)/),
    ).toBeVisible();
  });
  it("hides the trajectory until at least two insights exist", async () => {
    server.use(
      http.get(
        `${API_URL}/teacher/students/:id/progress`,
        () => HttpResponse.json(progressFixture()),
      ),
      http.get(
        `${API_URL}/teacher/students/:id/predictions`,
        () => HttpResponse.json([predictionFixture()]),
      ),
    );
    setSession(session);
    renderApp("/teacher/students/student-1?course=course-1");
    expect(
      await screen.findByText("Why EduGuard flagged this student"),
    ).toBeVisible();
    expect(screen.queryByText("Risk trajectory")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Risk probability by insight date/),
    ).not.toBeInTheDocument();
  });
});

describe("Signal feed integration", () => {
  it("never fetches alerts on student screens", async () => {
    let alertCalls = 0;
    server.use(
      http.get(`${API_URL}/teacher/alerts`, () => {
        alertCalls++;
        return HttpResponse.json(alertFeed);
      }),
      http.get(`${API_URL}/auth/me`, () =>
        HttpResponse.json({ ...session.user, role: "student" }),
      ),
    );
    setSession(session);
    renderApp();
    await screen.findByRole("heading", { name: "You’ve got this, Maya." });
    await waitFor(() =>
      expect(screen.queryByText(/Rising risk/)).not.toBeInTheDocument(),
    );
    expect(alertCalls).toBe(0);
  });
});
