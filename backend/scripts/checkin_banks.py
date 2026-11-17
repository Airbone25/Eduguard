"""Shared banks of student check-in sentences.

Used by scripts/generate_sentiment_corpus.py (labeled training corpus) and
scripts/generate_synthetic_weekly.py (weekly check-in texts), so the sentiment
classifier trains on the same language distribution the risk pipeline later
scores — one shared definition of what a struggling/steady student's weekly
note sounds like.
"""

TONE_OPENERS = {
    "positive": [
        "Feeling good about this week in {subject}",
        "I finally understood the {topic} unit",
        "Kept up with everything in {subject} this week",
        "My {subject} work is going better than last month",
        "Submitted everything on time and felt on top of it",
        "The practice problems are getting easier",
        "Happy with my {score} on the last assessment",
        "Studied with friends and it really helped",
    ],
    "neutral": [
        "Normal week in {subject}, nothing special",
        "We covered {topic} and I managed the homework",
        "Attendance was fine, work is piling up a bit",
        "Did the assignments, quiz was okay",
        "Same routine, keeping up with {subject}",
        "Got my {score} back, about what I expected",
        "Classes are fine, tired but managing",
        "Week went by quickly, assignments done",
    ],
    "negative": [
        "Falling behind in {subject} and it keeps getting worse",
        "I could not follow the {topic} lecture at all",
        "Missed classes again and my {score} was terrible",
        "Everything is piling up and I feel lost",
        "Late submissions again, I keep putting work off",
        "Failed the quiz and I do not know how to fix it",
        "Too tired to study, skipped the last session",
        "Stressed about {subject}, nothing is making sense",
    ],
}

TONE_CLOSERS = {
    "positive": [
        "Hoping to keep this streak going",
        "Will revise the same way next week",
        "Feeling confident about the next test",
        "This plan is working for me",
        "",
        "",
        "",
        "",
    ],
    "neutral": [
        "Let us see how next week goes",
        "No big concerns right now",
        "",
        "",
        "",
        "",
        "",
        "",
    ],
    "negative": [
        "I do not know how to catch up",
        "Next week will probably be worse",
        "I am worried about the coming test",
        "I think I need help but not sure with what",
        "",
        "",
        "",
        "",
    ],
}

TOPICS = {
    "positive": ["kinematics", "essay structure", "integration", "cell division", "supply and demand"],
    "neutral": ["photosynthesis", "the new chapter", "statistics", "the project", "vectors"],
    "negative": ["the new topic", "advanced problems", "the practical", "revision", "everything"],
}

POSITIVE = "positive"
NEUTRAL = "neutral"
NEGATIVE = "negative"
TONES = (POSITIVE, NEUTRAL, NEGATIVE)


def tone_distribution(level: float) -> tuple[float, float, float]:
    """How a weekly note sounds for a student at engagement `level` (0..1).

    Struggling weeks skew negative, steady weeks skew positive, mid-range
    weeks are dominated by neutral notes with a negative tail.
    """
    if level < 0.35:
        return (0.05, 0.25, 0.70)
    if level > 0.7:
        return (0.70, 0.25, 0.05)
    return (0.10, 0.55, 0.35)


def sample_text(rng, level: float, subject: str) -> str:
    """One weekly check-in sentence for a student at `level`, with noise."""
    p_pos, p_neu, p_neg = tone_distribution(level)
    tone = rng.choice(TONES, p=[p_pos, p_neu, p_neg])
    opener = rng.choice(TONE_OPENERS[tone])
    closer = rng.choice(TONE_CLOSERS[tone])
    parts = [
        opener.format(
            subject=subject,
            topic=rng.choice(TOPICS[tone]),
            score=str(int(rng.integers(35, 95))),
        )
    ]
    if closer:
        parts.append(closer)
    text = ". ".join(parts) + "."
    # Light noise: word dropout and casing wobble, so templates never repeat verbatim.
    words = text.split()
    if len(words) > 6 and rng.random() < 0.25:
        del words[rng.integers(1, len(words) - 1)]
    if rng.random() < 0.3:
        words[0] = words[0].lower()
    elif rng.random() < 0.15:
        words[0] = words[0].upper()
    return " ".join(words)
