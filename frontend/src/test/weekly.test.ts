import { describe, it, expect } from "vitest";
import {
  weeklyFormSchema,
  weeklyPayload,
  type WeeklyForm,
} from "@/features/weekly-records/schema";
import { parseCsv } from "@/features/weekly-records/csv";
describe("Raw weekly entry", () => {
  it("rejects derived features, impossible counts, fractions and invalid scores", () => {
    for (const values of [
      { classes_held: "4", classes_attended: "5" },
      { assessment_avg_score: "101" },
      { classes_held: "1.5" },
      { Risk_Score: "0.9" },
    ])
      expect(
        weeklyFormSchema.safeParse({
          records: [{ student_id: "s1", selected: true, values }],
        }).success,
      ).toBe(false);
  });
  it("preserves zero and missing values; only selected students are submitted", () => {
    const form: WeeklyForm = {
      records: [
        {
          student_id: "s1",
          selected: true,
          values: {
            classes_held: "5",
            classes_attended: "0",
            student_checkin_text: "A normal check-in",
          },
        },
        { student_id: "s2", selected: false, values: {} },
      ],
    };
    expect(weeklyFormSchema.safeParse(form).success).toBe(true);
    expect(weeklyPayload(form, "c1", "2026-09-28").records).toEqual([
      expect.objectContaining({
        student_id: "s1",
        classes_attended: 0,
        assessment_avg_score: null,
        student_checkin_text: "A normal check-in",
      }),
    ]);
  });
  it("reads quoted CSV correctly and rejects malformed or duplicate headers", () => {
    expect(
      parseCsv(
        'roll_number,student_checkin_text\r\nS1,"Hello, ""class""\nToday"',
      ),
    ).toEqual([
      ["roll_number", "student_checkin_text"],
      ["S1", 'Hello, "class"\nToday'],
    ]);
    expect(() => parseCsv("a,a\n1,2")).toThrow("Duplicate");
    expect(() => parseCsv('a,b\n"oops,2')).toThrow("unclosed");
  });
});
