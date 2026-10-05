def explanation_signals(features: dict[str, float | None]) -> list[dict]:
    """Measured observations, independent of the final probability; never causal claims."""
    signals = []
    for feature, threshold, factor, label in [
        ("attendance_change_4wk", -8, "attendance", "Attendance"),
        ("score_change_4wk", -10, "avg_score", "Assessment average"),
    ]:
        value = features.get(feature)
        if value is not None and value <= threshold:
            signals.append(
                {
                    "code": feature,
                    "factor": factor,
                    "direction": "down",
                    "severity": min(1.0, abs(value) / 20),
                    "message": f"{label} decreased by {abs(value):.1f} points over four weeks.",
                }
            )
    streak = features.get("late_submission_streak")
    if streak is not None and streak >= 2:
        signals.append(
            {
                "code": "late_submission_streak",
                "factor": "late_submissions",
                "direction": "up",
                "severity": min(1.0, streak / 4),
                "message": (
                    f"Late submissions were recorded in {int(streak)} consecutive observed weeks."
                ),
            }
        )
    participation = features.get("participation_rate")
    if participation is not None and participation < 40:
        signals.append(
            {
                "code": "low_participation",
                "factor": "participation",
                "direction": "low",
                "severity": (40 - participation) / 40,
                "message": (
                    f"Participation was recorded for {participation:.1f}% "
                    "of opportunities this week."
                ),
            }
        )
    days = features.get("days_since_last_login")
    if days is not None and days >= 7:
        signals.append(
            {
                "code": "lms_inactivity",
                "factor": "lms",
                "direction": "up",
                "severity": min(1.0, days / 14),
                "message": f"The recorded time since the last LMS login is {int(days)} days.",
            }
        )
    return sorted(signals, key=lambda s: (-s["severity"], s["code"]))[:3]
