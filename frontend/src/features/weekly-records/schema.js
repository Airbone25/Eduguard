export const weeklyColumns = [
  ["classes_held", "Classes held"],
  ["classes_attended", "Classes attended"],
  ["assessment_avg_score", "Assessment average"],
  ["assessment_count", "Assessments"],
  ["assignment_count", "Assignments"],
  ["assignments_completed", "Completed"],
  ["late_submissions", "Late submissions"],
  ["assignment_avg_score", "Assignment average"],
  ["quiz_avg_score", "Quiz average"],
  ["study_hours_weekly", "Study hours"],
  ["participation_count", "Participation"],
  ["participation_opportunities", "Participation opportunities"],
];

export const rawFields = [
  ...weeklyColumns.map((c) => c[0]),
  "last_minute_submissions",
  "avg_submission_delay_days",
  "quiz_count",
  "quiz_attempt_count",
  "lms_login_count",
  "lms_active_days",
  "avg_lms_session_min",
  "total_lms_time_min",
  "days_since_last_login",
  "student_confidence_score",
  "student_checkin_text",
];

const measurements = new Set([
  "study_hours_weekly",
  "assessment_avg_score",
  "assignment_avg_score",
  "quiz_avg_score",
  "avg_submission_delay_days",
  "avg_lms_session_min",
  "total_lms_time_min",
]);

export function validateWeeklyRecords(records) {
  const errors = {};
  const selected = records.filter((r) => r.selected);
  if (!selected.length || selected.length > 100) {
    return {
      isValid: false,
      globalError: "Select between 1 and 100 students per submission.",
      errors,
    };
  }

  records.forEach((record, index) => {
    if (!record.selected) return;
    Object.entries(record.values || {}).forEach(([key, value]) => {
      if (!rawFields.includes(key)) {
        errors[`${index}.${key}`] = "Only raw school fields are accepted.";
        return;
      }
      if (key === "student_checkin_text") {
        if (value && value.length > 5000) errors[`${index}.${key}`] = "Maximum 5000 characters.";
        return;
      }
      if (!value || value.toString().trim() === "") return;
      const num = Number(value);
      const max =
        key.includes("score") && key !== "student_confidence_score"
          ? 100
          : key === "study_hours_weekly"
            ? 168
            : key === "lms_active_days"
              ? 7
              : key === "student_confidence_score"
                ? 5
                : 1000000;
      if (
        !Number.isFinite(num) ||
        num < 0 ||
        num > max ||
        (!measurements.has(key) && !Number.isInteger(num)) ||
        (key === "student_confidence_score" && num < 1)
      ) {
        errors[`${index}.${key}`] = `Enter ${measurements.has(key) ? "a number" : "a whole number"} from ${key === "student_confidence_score" ? 1 : 0} to ${max}.`;
      }
      if (
        measurements.has(key) &&
        value.toString().includes(".") &&
        value.toString().split(".")[1].length > 4
      ) {
        errors[`${index}.${key}`] = "Use at most four decimal places.";
      }
    });

    const pairs = [
      ["classes_attended", "classes_held"],
      ["assignments_completed", "assignment_count"],
      ["late_submissions", "assignment_count"],
      ["late_submissions", "assignments_completed"],
      ["last_minute_submissions", "assignment_count"],
      ["participation_count", "participation_opportunities"],
    ];
    for (const [child, parent] of pairs) {
      const cVal = record.values[child];
      const pVal = record.values[parent];
      if (
        cVal !== undefined &&
        cVal !== "" &&
        pVal !== undefined &&
        pVal !== "" &&
        Number(cVal) > Number(pVal)
      ) {
        errors[`${index}.${child}`] = `${child.replace(/_/g, " ")} cannot exceed ${parent.replace(/_/g, " ")}.`;
      }
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function weeklyPayload(records, courseId, week) {
  return {
    records: records
      .filter((r) => r.selected)
      .map((row) => ({
        student_id: row.student_id,
        course_offering_id: courseId,
        week_start: week,
        ...Object.fromEntries(
          rawFields.map((field) => [
            field,
            row.values[field] !== undefined && row.values[field] !== ""
              ? field === "student_checkin_text"
                ? row.values[field]
                : Number(row.values[field])
              : null,
          ]),
        ),
      })),
  };
}
