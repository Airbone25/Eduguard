export const today = () => new Date().toISOString().slice(0, 10);

export function monday(day) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function termRange(start, end, current = today()) {
  const valid = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(start) || !valid(end))
    return {
      error: "Choose the term start and end dates provided by your school.",
      weeks: 0,
    };
  if (end < start || end > current)
    return {
      error:
        "The end date must be on or after the start date and no later than today.",
      weeks: 0,
    };
  const first =
    Date.parse(monday(start)) + (monday(start) < start ? 7 * 86400000 : 0);
  const weeks =
    Math.round((Date.parse(monday(end)) - first) / (7 * 86400000)) + 1;
  if (weeks < 1)
    return {
      error: "Choose a range containing at least one Monday week start.",
      weeks: 0,
    };
  if (weeks > 52)
    return {
      error: "Choose a term covering no more than 52 calendar weeks.",
      weeks: 0,
    };
  return { error: null, weeks };
}

export function chartWeeks(rows, asOf, count = 8) {
  const byDate = new Map(
    (rows || [])
      .filter((row) => row.week_start <= asOf)
      .map((row) => [row.week_start, row]),
  );
  const end = new Date(`${monday(asOf)}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(end);
    day.setUTCDate(day.getUTCDate() - (count - index - 1) * 7);
    const week = day.toISOString().slice(0, 10);
    const row = byDate.get(week);
    return {
      week_start: week,
      score: row?.assessment_avg_score ?? null,
      attendance: row?.attendance_percent ?? null,
      assignments:
        row?.assignment_count && row.assignments_completed !== null
          ? (row.assignments_completed / row.assignment_count) * 100
          : null,
    };
  });
}

export function goalProgress(target, value) {
  if (target == null || value === null || isNaN(value)) return null;
  return {
    reached: value >= target,
    percent:
      target === 0 ? 100 : Math.min(100, Math.max(0, (value / target) * 100)),
  };
}
