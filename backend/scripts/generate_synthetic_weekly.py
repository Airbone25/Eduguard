"""Generate synthetic longitudinal weekly records for model training.

Every simulated student has a latent trajectory (steady, slumping, recovering,
chronic, volatile). Weekly observations are noisy views of that latent state,
and the training label is the true phase — so the model must infer the latent
state from noisy, possibly missing observations, exactly like production.

The output is raw weekly data in the same shape teachers enter into EduGuard;
derived features are never emitted. Feature computation happens in
scripts/train_model.py using the real app.ml.feature_builder, so training and
serving always see identical features.

Run: python -m scripts.generate_synthetic_weekly [--students 1600] [--seed 2026]
"""

import argparse
import csv
from datetime import date, timedelta
from pathlib import Path

import numpy as np

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parents[0]

FIRST_MONDAY = date(2026, 1, 5)
SUBJECTS = [
    ("MATH", "Mathematics"),
    ("PHY", "Physics"),
    ("CHEM", "Chemistry"),
    ("HIST", "History"),
    ("ENG", "English"),
    ("BIO", "Biology"),
]
# Subject difficulty offsets applied to score latents.
DIFFICULTY = {"MATH": -3.0, "PHY": -2.0, "CHEM": -2.0, "HIST": 0.0, "ENG": 0.5, "BIO": -0.5}
PERSONAS = ("steady", "slumping", "recovering", "chronic", "volatile")
PERSONA_WEIGHTS = (0.35, 0.20, 0.15, 0.15, 0.15)

FIELDS = [
    "student_id",
    "course_id",
    "subject_code",
    "subject_name",
    "week_start",
    "classes_held",
    "classes_attended",
    "assessment_count",
    "assessment_avg_score",
    "assignment_count",
    "assignments_completed",
    "late_submissions",
    "last_minute_submissions",
    "avg_submission_delay_days",
    "assignment_avg_score",
    "quiz_count",
    "quiz_attempt_count",
    "quiz_avg_score",
    "lms_login_count",
    "lms_active_days",
    "avg_lms_session_min",
    "total_lms_time_min",
    "days_since_last_login",
    "participation_count",
    "participation_opportunities",
    "study_hours_weekly",
    "student_confidence_score",
    "source",
    "struggling",
]


def clamp(value, low, high):
    return max(low, min(high, value))


def persona_plan(rng, weeks):
    """Return per-week (level 0..1, label) where level is latent engagement."""
    kind = rng.choice(PERSONAS, p=PERSONA_WEIGHTS)
    levels, labels = [], []
    if kind == "steady":
        for _week in range(weeks):
            levels.append(1.0)
            labels.append(0)
    elif kind == "slumping":
        onset = int(rng.integers(5, max(6, weeks - 4)))
        span = int(rng.integers(3, 5))
        for week in range(weeks):
            progress = clamp((week - onset + 1) / span, 0.0, 1.0)
            levels.append(1.0 - 0.8 * progress)
            labels.append(1 if week > onset else 0)
    elif kind == "recovering":
        start = int(rng.integers(3, max(4, weeks - 5)))
        span = int(rng.integers(2, 4))
        for week in range(weeks):
            progress = clamp((week - start + 1) / span, 0.0, 1.0)
            levels.append(0.2 + 0.8 * progress)
            labels.append(1 if week < start else 0)
    elif kind == "chronic":
        for _week in range(weeks):
            levels.append(0.2)
            labels.append(1)
    else:  # volatile: alternating multi-week blocks of good and poor engagement
        block = 0
        for week in range(weeks):
            if week % 2 == 0 and week % 4 < 2:
                block = 1 if block == 0 else 0
            levels.append(1.0 if block == 0 else 0.25)
            labels.append(0 if block == 0 else 1)
    jitter = rng.normal(0, 0.04, size=weeks)
    levels = [clamp(level + jitter[i], 0.05, 1.0) for i, level in enumerate(levels)]
    return levels, labels


def observe(rng, level, ability, difficulty, week, weeks):
    """Noisy weekly observations of the latent state. Level 1 = thriving."""
    good = level
    attendance_p = clamp(0.35 + 0.62 * good + rng.normal(0, 0.05), 0.05, 0.99)
    classes_held = int(rng.integers(3, 7))
    classes_attended = int(min(classes_held, round(classes_held * attendance_p)))

    has_assessment = rng.random() < 0.85
    assessment_count = int(rng.integers(1, 3)) if has_assessment else 0
    score_mean = ability + difficulty + 8.0 * (good - 0.55) * 2.0
    assessment_avg_score = (
        round(clamp(rng.normal(score_mean, 6.0), 0, 100), 2) if has_assessment else ""
    )

    assignment_count = int(rng.integers(0, 5)) if rng.random() < 0.9 else 0
    late_rate = clamp(0.55 - 0.5 * good + rng.normal(0, 0.08), 0.0, 0.9)
    assignments_completed = int(round(assignment_count * clamp(0.5 + 0.5 * good, 0.1, 1.0)))
    late_submissions = int(
        min(assignments_completed, round(assignments_completed * late_rate))
    )
    last_minute_submissions = int(
        min(assignment_count, round(assignment_count * clamp(0.45 - 0.35 * good, 0.0, 0.9)))
    )
    avg_submission_delay_days = (
        round(clamp(6.0 * (1 - good) + rng.normal(0, 1.0), 0, 14), 2)
        if late_submissions
        else round(clamp(abs(rng.normal(0.5, 0.5)), 0, 3), 2)
    )
    assignment_avg_score = round(
        clamp(rng.normal(score_mean + rng.normal(0, 3.0), 5.0), 0, 100), 2
    )

    has_quiz = rng.random() < 0.6
    quiz_count = int(rng.integers(1, 3)) if has_quiz else 0
    quiz_avg_score = (
        round(clamp(rng.normal(score_mean + rng.normal(0, 4.0), 7.0), 0, 100), 2)
        if has_quiz
        else ""
    )

    lms_energy = clamp(0.25 + 0.85 * good + rng.normal(0, 0.08), 0.05, 1.3)
    lms_login_count = int(clamp(round(10 * lms_energy + rng.normal(0, 2)), 0, 30))
    lms_active_days = int(clamp(round(5.5 * lms_energy), 0, 7))
    avg_lms_session_min = round(clamp(22 * lms_energy + rng.normal(0, 4), 0, 90), 2)
    total_lms_time_min = round(lms_active_days * avg_lms_session_min, 2)
    days_since_last_login = int(
        clamp(round(6.5 * (1 - good) + abs(rng.normal(0, 1.2))), 0, 14)
    )

    opportunities = int(rng.integers(5, 16))
    participation_p = clamp(0.12 + 0.8 * good + rng.normal(0, 0.06), 0.0, 1.0)
    participation_count = int(round(opportunities * participation_p))

    study_hours_weekly = round(clamp(2.0 + 10.0 * good + rng.normal(0, 1.5), 0, 40), 2)
    confidence = int(clamp(round(1.5 + 3.5 * good + rng.normal(0, 0.5)), 1, 5))

    return {
        "classes_held": classes_held,
        "classes_attended": classes_attended,
        "assessment_count": assessment_count,
        "assessment_avg_score": assessment_avg_score,
        "assignment_count": assignment_count,
        "assignments_completed": assignments_completed,
        "late_submissions": late_submissions,
        "last_minute_submissions": last_minute_submissions,
        "avg_submission_delay_days": avg_submission_delay_days,
        "assignment_avg_score": assignment_avg_score,
        "quiz_count": quiz_count,
        "quiz_attempt_count": quiz_count if has_quiz else 0,
        "quiz_avg_score": quiz_avg_score,
        "lms_login_count": lms_login_count,
        "lms_active_days": lms_active_days,
        "avg_lms_session_min": avg_lms_session_min,
        "total_lms_time_min": total_lms_time_min,
        "days_since_last_login": days_since_last_login,
        "participation_count": participation_count,
        "participation_opportunities": opportunities,
        "study_hours_weekly": study_hours_weekly,
        "student_confidence_score": confidence,
        "source": "manual",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--students", type=int, default=1600)
    parser.add_argument("--weeks", type=int, default=14)
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument(
        "--out",
        type=Path,
        default=REPO_ROOT / "outputs" / "synthetic_weekly.csv",
    )
    args = parser.parse_args()

    master = np.random.default_rng(args.seed)
    args.out.parent.mkdir(parents=True, exist_ok=True)

    label_counts = [0, 0]
    rows_written = 0
    with args.out.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for student_index in range(args.students):
            student_id = f"S{student_index + 1:06d}"
            course_count = 3 if master.random() < 0.1 else 2
            course_ids = master.choice(len(SUBJECTS), size=course_count, replace=False)
            for course_number, subject_index in enumerate(course_ids, start=1):
                code, name = SUBJECTS[int(subject_index)]
                course_id = f"C{student_index + 1:06d}{course_number}"
                rng = np.random.default_rng(
                    args.seed * 1_000_003 + student_index * 1009 + course_number
                )
                ability = float(master.normal(74, 8))
                levels, labels = persona_plan(rng, args.weeks)
                for week in range(args.weeks):
                    row = observe(rng, levels[week], ability, DIFFICULTY[code], week, args.weeks)
                    row.update(
                        {
                            "student_id": student_id,
                            "course_id": course_id,
                            "subject_code": code,
                            "subject_name": name,
                            "week_start": (FIRST_MONDAY + timedelta(weeks=week)).isoformat(),
                            "struggling": labels[week],
                        }
                    )
                    writer.writerow(row)
                    rows_written += 1
                    label_counts[labels[week]] += 1
    print(f"wrote {rows_written} rows to {args.out}")
    print(
        f"labels: struggling={label_counts[1]} ({label_counts[1] / rows_written:.1%}), "
        f"steady={label_counts[0]}"
    )


if __name__ == "__main__":
    main()
