import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { API_URL, setSession } from "@/lib/api/client";
import { server } from "./server";
import { prediction, session } from "./fixtures";
import { Insights } from "@/features/predictions/Insights";

function renderInsights(withPrediction = prediction) {
  setSession(session);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Insights studentId="student-1" courseId="course-1" prediction={withPrediction} />
    </QueryClientProvider>,
  );
}

describe("Insight explainability", () => {
  it("shows what moved the prediction with signed contributions", () => {
    renderInsights();
    const contrib = within(screen.getByLabelText("Feature contributions"));
    expect(contrib.getByText("What moved this prediction")).toBeVisible();
    expect(contrib.getByText("Late submissions")).toBeVisible();
    const raises = screen.getByText("+0.42");
    expect(raises).toHaveClass("raises");
    const lowers = screen.getByText("−0.11");
    expect(lowers).toHaveClass("lowers");
    expect(contrib.getByText("62")).toBeVisible();
  });

  it("shows no contribution block for a prediction without attributions", () => {
    renderInsights({ ...prediction, contributions: [] });
    expect(screen.queryByText("What moved this prediction")).toBeNull();
    expect(screen.queryByText("What-if simulator")).toBeNull();
  });

  it("simulates attendance recovery and shows the new probability", async () => {
    const user = userEvent.setup();
    renderInsights();
    const slider = screen.getByRole("slider", { name: "Simulate Attendance %" });
    fireEvent.change(slider, { target: { value: "95" } });
    await waitFor(
      () => expect(screen.getByText(/Probability 0\.55/)).toBeVisible(),
      { timeout: 3000 },
    );
    await waitFor(() => expect(screen.getByText("0.05")).toBeVisible());
    expect(screen.getByText("Reset simulation")).toBeVisible();
    await user.click(screen.getByText("Reset simulation"));
    await waitFor(() => expect(screen.queryByText("Reset simulation")).toBeNull());
  });

  it("surfaces simulation failures without losing the panel", async () => {
    server.use(
      http.post(`${API_URL}/teacher/predictions/what-if`, () =>
        HttpResponse.json(
          { error: { code: "INFERENCE_FAILED", message: "boom" } },
          { status: 503 },
        ),
      ),
    );
    renderInsights();
    fireEvent.change(
      screen.getByRole("slider", { name: "Simulate Late submissions" }),
      { target: { value: "1" } },
    );
    expect(
      await screen.findByText("The simulation failed. Adjust the values and try again."),
    ).toBeVisible();
    expect(screen.getByText("What-if simulator")).toBeVisible();
  });
});
