import { describe, expect, it } from "vitest";
import {
  chartWeeks,
  goalProgress,
  termRange,
} from "@/features/progress/metrics";
describe("Longitudinal chart presentation", () => {
  it("requires explicit term dates and bounds the weekly request without future data", () => {
    expect(termRange("", "2026-10-03", "2026-10-06").weeks).toBe(0);
    expect(termRange("2026-08-03", "2026-10-03", "2026-10-06")).toEqual({
      error: null,
      weeks: 9,
    });
    expect(termRange("2026-08-05", "2026-10-03", "2026-10-06")).toEqual({
      error: null,
      weeks: 8,
    });
    for (const [start, end] of [
      ["2026-10-03", "2026-10-02"],
      ["2026-02-30", "2026-10-03"],
      ["2024-01-01", "2026-10-03"],
      ["2026-10-01", "2026-10-07"],
    ])
      expect(termRange(start, end, "2026-10-06").error).not.toBeNull();
  });
  it("preserves missing weeks and excludes future records", () => {
    const row = {
      week_start: "2026-09-28",
      assessment_avg_score: 70,
      attendance_percent: 80,
      assignment_count: 4,
      assignments_completed: 3,
      late_submissions: 1,
    };
    const result = chartWeeks(
      [row, { ...row, week_start: "2026-10-05", assessment_avg_score: 100 }],
      "2026-10-04",
      4,
    );
    expect(result).toHaveLength(4);
    expect(result[0].score).toBeNull();
    expect(result[3]).toMatchObject({ score: 70, assignments: 75 });
    expect(result.some((r) => r.score === 100)).toBe(false);
  });
  it("does not treat missing assignments as zero or missing goals as complete", () => {
    expect(
      chartWeeks(
        [
          {
            week_start: "2026-09-28",
            assessment_avg_score: null,
            attendance_percent: null,
            assignment_count: 0,
            assignments_completed: 0,
            late_submissions: null,
          },
        ],
        "2026-10-04",
        1,
      )[0].assignments,
    ).toBeNull();
    expect(goalProgress(80, null)).toBeNull();
    expect(goalProgress(80, 60)).toEqual({ reached: false, percent: 75 });
  });
});
