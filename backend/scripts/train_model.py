"""Retrain the EduGuard risk model on synthetic longitudinal weekly records.

This closes the train/serve loop: features are computed by the real
app.ml.feature_builder over raw weekly records, exactly as production does —
never from a precomputed feature table.

What it does:
1. Reads the raw weekly CSV produced by scripts/generate_synthetic_weekly.py.
2. Builds the weekly-v1 feature matrix per (student, course, as_of Monday),
   injecting Math/Physics/Chemistry subject marks the same way
   app.ml.inference.ordered_features does.
3. Evaluates logistic regression, histogram gradient boosting and random
   forest with GroupKFold split by student (no leakage across a student's
   weekly rows) and reports ROC-AUC, PR-AUC, Brier, log loss and calibration
   error on out-of-fold probabilities.
4. Derives decision thresholds from the winner's out-of-fold probabilities:
   at_risk = F2-optimal cut; watch/priority bands = 70th/90th percentiles of
   predicted risk (staffing-proportional), not arbitrary constants.
5. Refits the winner on all rows, writes the artifact + model_metadata.json
   (both the backend copy and the repo-root mirror), and self-verifies the
   result with the production loader load_model().

Run: python -m scripts.train_model --overwrite
"""

import argparse
import hashlib
import io
import json
import shutil
from collections import defaultdict
from datetime import date
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    log_loss,
    precision_recall_curve,
    roc_auc_score,
)
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.ml.feature_builder import build_features
from app.ml.model_loader import load_model

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parents[0]
BUNDLE = BACKEND_ROOT / "artifacts" / "eduguard_risk_model.joblib"
METADATA = BACKEND_ROOT / "artifacts" / "model_metadata.json"
ROOT_MIRROR = REPO_ROOT / "eduguard_risk_model.joblib"
REPORT = REPO_ROOT / "outputs" / "training_report.json"

RANDOM_STATE = 42


def candidate_models() -> dict[str, Pipeline]:
    return {
        "logistic_regression": Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
                (
                    "classifier",
                    LogisticRegression(
                        max_iter=2000, class_weight="balanced", random_state=RANDOM_STATE
                    ),
                ),
            ]
        ),
        "hist_gradient_boosting": Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "classifier",
                    HistGradientBoostingClassifier(
                        max_iter=150, learning_rate=0.08, random_state=RANDOM_STATE
                    ),
                ),
            ]
        ),
        "random_forest": Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "classifier",
                    RandomForestClassifier(
                        n_estimators=200,
                        min_samples_leaf=2,
                        class_weight="balanced",
                        n_jobs=-1,
                        random_state=RANDOM_STATE,
                    ),
                ),
            ]
        ),
    }


def f2_optimal_threshold(y_true: np.ndarray, probabilities: np.ndarray) -> float:
    precision, recall, thresholds = precision_recall_curve(y_true, probabilities)
    denominator = 4 * precision + recall
    f2 = np.divide(
        5 * precision * recall,
        denominator,
        out=np.zeros_like(denominator),
        where=denominator > 0,
    )
    best = int(np.argmax(f2[:-1]))
    return float(thresholds[best])


def expected_calibration_error(y_true, probabilities, bins: int = 10) -> float:
    edges = np.linspace(0.0, 1.0, bins + 1)
    actual = np.searchsorted(edges, probabilities, side="right") - 1
    actual = np.clip(actual, 0, bins - 1)
    error = 0.0
    for bin_index in range(bins):
        mask = actual == bin_index
        if mask.sum() == 0:
            continue
        error += mask.mean() * abs(probabilities[mask].mean() - y_true[mask].mean())
    return float(error)


def build_dataset(csv_path: Path, feature_names: list[str], subject_features: dict):
    """Feature matrix + labels via the real builder. Returns frame, groups, meta."""
    raw = pd.read_csv(csv_path, parse_dates=["week_start"])
    raw["week_start"] = raw["week_start"].dt.date
    raw["struggling"] = raw["struggling"].astype(int)

    rows: list[list[float | None]] = []
    labels: list[int] = []
    groups: list[str] = []
    skipped = 0
    grouped = defaultdict(list)
    for row in raw.itertuples(index=False):
        grouped[(row.student_id, row.course_id)].append(
            {
                "week_start": row.week_start,
                "subject_code": row.subject_code,
                "subject_name": row.subject_name,
                "struggling": row.struggling,
                **{
                    field: (None if (value == "" or pd.isna(value)) else value)
                    for field, value in row._asdict().items()
                    if field
                    not in (
                        "student_id",
                        "course_id",
                        "subject_code",
                        "subject_name",
                        "week_start",
                        "struggling",
                    )
                },
            }
        )
    for (student_id, _course_id), records in grouped.items():
        records.sort(key=lambda r: r["week_start"])
        subject_code, subject_name = records[0]["subject_code"], records[0]["subject_name"]
        subject = subject_features.get(subject_code.casefold()) or subject_features.get(
            subject_name.casefold()
        )
        for record in records:
            anchor = record["week_start"]
            built = build_features(records, anchor)
            values = {name: built.features.get(name.lower()) for name in feature_names}
            if subject in feature_names:
                values[subject] = built.features.get("avg_score")
            rows.append([values[name] for name in feature_names])
            labels.append(record["struggling"])
            groups.append(student_id)
            if built.metadata["history_weeks_available"] < 2:
                skipped += 1
    frame = pd.DataFrame(rows, columns=feature_names)
    return frame, np.array(labels), np.array(groups), skipped


def evaluate(name: str, estimator: Pipeline, X, y, groups, folds: int) -> dict:
    oof = np.zeros(len(y), dtype=float)
    for train_index, test_index in GroupKFold(n_splits=folds).split(X, y, groups):
        model = sklearn.base.clone(estimator)
        model.fit(X.iloc[train_index], y[train_index])
        oof[test_index] = model.predict_proba(X.iloc[test_index])[:, 1]
    return {
        "name": name,
        "oof": oof,
        "roc_auc": float(roc_auc_score(y, oof)),
        "pr_auc": float(average_precision_score(y, oof)),
        "brier": float(brier_score_loss(y, oof)),
        "log_loss": float(log_loss(y, oof, labels=[0, 1])),
        "ece": expected_calibration_error(y, oof),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset", type=Path, default=REPO_ROOT / "outputs" / "synthetic_weekly.csv"
    )
    parser.add_argument("--folds", type=int, default=5)
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument(
        "--overwrite", action="store_true", help="Replace an existing artifact and its root mirror."
    )
    args = parser.parse_args()

    if not args.dataset.exists():
        raise SystemExit(
            f"Dataset not found: {args.dataset}. Run scripts.generate_synthetic_weekly first."
        )
    if not METADATA.exists():
        raise SystemExit(
            "artifacts/model_metadata.json is required for feature names and subject mapping."
        )
    if BUNDLE.exists() and not args.overwrite:
        raise SystemExit("Artifact already exists. Pass --overwrite to replace it.")

    current = json.loads(METADATA.read_text(encoding="utf-8"))
    feature_names = list(current["feature_names"])
    subject_features = current.get("subject_features", {})

    print(f"Building features from {args.dataset} ...")
    frame, y, groups, skipped = build_dataset(args.dataset, feature_names, subject_features)
    positives = int(y.sum())
    print(
        f"{len(y)} training rows from {len(set(groups))} students; "
        f"positives={positives} ({positives / len(y):.1%}); thin-history rows={skipped}"
    )

    results = []
    for name, estimator in candidate_models().items():
        print(f"Evaluating {name} ({args.folds}-fold GroupKFold by student) ...")
        results.append(evaluate(name, estimator, frame, y, groups, args.folds))
    results.sort(key=lambda r: (r["roc_auc"], r["pr_auc"]), reverse=True)
    print("\nOut-of-fold metrics:")
    for result in results:
        metrics = (
            f"ROC-AUC={result['roc_auc']:.4f}  PR-AUC={result['pr_auc']:.4f}  "
            f"Brier={result['brier']:.4f}  LogLoss={result['log_loss']:.4f}"
            f"  ECE={result['ece']:.4f}"
        )
        print(f"  {result['name']:<24} {metrics}")
    winner = results[0]
    oof = winner["oof"]

    at_risk = round(f2_optimal_threshold(y, oof), 4)
    # Quantile bands are degenerate when the model separates classes almost
    # perfectly (probabilities collapse to ~0/1), so anchor the watch and
    # priority bands to the operating cut itself: start watching at half the
    # risk bar, escalate to priority support halfway to certainty. This keeps
    # the semantics medium < at_risk < high at any calibration level.
    medium = round(at_risk * 0.5, 4)
    high = round(at_risk + (1.0 - at_risk) * 0.5, 4)
    print(f"\nSelected model: {winner['name']}")
    print(f"Thresholds: at_risk={at_risk} (F2-optimal), medium={medium}, high={high}")

    final = candidate_models()[winner["name"]]
    final.fit(frame, y)
    train_auc = float(roc_auc_score(y, final.predict_proba(frame)[:, 1]))

    buffer = io.BytesIO()
    joblib.dump(final, buffer)
    artifact_bytes = buffer.getvalue()
    checksum = hashlib.sha256(artifact_bytes).hexdigest()

    metadata = {
        "model_name": "EduGuard Risk Model",
        "model_version": f"trained-synthetic-v1-seed{args.seed}",
        "feature_version": current["feature_version"],
        "adapter_version": current["adapter_version"],
        "sklearn_version": sklearn.__version__,
        "artifact_sha256": checksum,
        "feature_names": feature_names,
        "thresholds": {"medium": medium, "high": high, "at_risk": at_risk},
        "subject_features": subject_features,
        "trained_at": date.today().isoformat(),
        "provenance": (
            f"Trained by scripts/train_model.py on synthetic longitudinal weekly records "
            f"generated by scripts/generate_synthetic_weekly.py (seed={args.seed}); features "
            f"computed with app.ml.feature_builder ({current['feature_version']}); "
            f"{args.folds}-fold GroupKFold split by student; notebook not executed."
        ),
        "input_semantics": current.get(
            "input_semantics",
            "Per-course weekly-v1 features from raw weekly records; "
            "missing values imputed by the fitted pipeline.",
        ),
        "preprocessing": [type(step).__name__ for _, step in final.steps],
        "metrics": {
            "selection_metric": "roc_auc (out-of-fold)",
            "selected_model": winner["name"],
            "rows": int(len(y)),
            "students": int(len(set(groups))),
            "positives": positives,
            "positive_rate": round(positives / len(y), 4),
            "roc_auc": round(winner["roc_auc"], 4),
            "pr_auc": round(winner["pr_auc"], 4),
            "brier": round(winner["brier"], 4),
            "log_loss": round(winner["log_loss"], 4),
            "expected_calibration_error": round(winner["ece"], 4),
            "train_roc_auc": round(train_auc, 4),
            "cv_folds": args.folds,
            "split": "GroupKFold by student",
            "threshold_derivation": {
                "at_risk": "F2-optimal out-of-fold cut",
                "medium": "half of the at_risk cut (start watching)",
                "high": "halfway from at_risk cut to certainty (priority support)",
            },
            "candidates": [
                {k: round(v, 4) if isinstance(v, float) else v for k, v in r.items() if k != "oof"}
                for r in results
            ],
        },
    }

    if BUNDLE.exists():
        previous = REPO_ROOT / "outputs" / "previous_artifact.joblib"
        if not previous.exists():
            shutil.copy2(BUNDLE, previous)
            print(f"Backed up previous artifact to {previous}")

    BUNDLE.write_bytes(artifact_bytes)
    ROOT_MIRROR.write_bytes(artifact_bytes)
    METADATA.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        json.dumps({**metadata["metrics"], "thresholds": metadata["thresholds"]}, indent=2) + "\n",
        encoding="utf-8",
    )

    loaded = load_model("artifacts/eduguard_risk_model.joblib", "artifacts/model_metadata.json")
    probe = pd.DataFrame([[np.nan] * len(loaded.feature_names)], columns=loaded.feature_names)
    probability = float(loaded.pipeline.predict_proba(probe)[0, 1])
    print("\nProduction loader self-check: OK")
    print(f"  steps={[type(step).__name__ for _, step in loaded.pipeline.steps]}")
    print(f"  all-missing probe probability={probability:.4f}")
    print(f"  checksum={checksum}")
    print(f"  artifact={BUNDLE}")
    print(f"  root mirror={ROOT_MIRROR}")
    print(f"  report={REPORT}")


if __name__ == "__main__":
    main()
