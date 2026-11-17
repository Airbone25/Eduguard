import math

import numpy as np
import pandas as pd

from app.ml.feature_builder import FeatureResult
from app.ml.model_loader import LoadedModel


def ordered_features(
    model: LoadedModel, features: FeatureResult, subject_code: str, subject_name: str
) -> dict[str, float | None]:
    if features.feature_version != model.metadata["feature_version"]:
        raise ValueError("Feature service version does not match model adapter")
    values = {name: features.features.get(name.lower()) for name in model.feature_names}
    subject_features = model.metadata.get("subject_features", {})
    subject = subject_features.get(subject_code.casefold()) or subject_features.get(
        subject_name.casefold()
    )
    if subject in model.feature_names:
        values[subject] = features.features.get("avg_score")
    # Missing subject marks and sentiment remain null. Do not query another teacher's courses.
    if any(v is not None and not math.isfinite(v) for v in values.values()):
        raise ValueError("Non-finite feature")
    return values


def predict(model: LoadedModel, values: dict[str, float | None]) -> dict:
    return predict_batch(model, [values])[0]


def predict_batch(
    model: LoadedModel, rows: list[dict[str, float | None]]
) -> list[dict]:
    if not rows:
        raise ValueError("No rows to predict")
    if any(set(values) != set(model.feature_names) for values in rows):
        raise ValueError("Input feature names do not match model")
    frame = pd.DataFrame(
        [
            [np.nan if values[name] is None else values[name] for name in model.feature_names]
            for values in rows
        ],
        columns=model.feature_names,
    )
    probabilities = model.pipeline.predict_proba(frame)
    if (
        probabilities.shape != (len(rows), 2)
        or not np.isfinite(probabilities).all()
        or not np.all((probabilities >= 0) & (probabilities <= 1))
        or not np.allclose(probabilities.sum(axis=1), 1)
    ):
        raise ValueError("Model returned invalid probabilities")
    thresholds = model.metadata["thresholds"]
    outputs = []
    for probability_value in probabilities[:, 1]:
        probability = float(probability_value)
        if not math.isfinite(probability) or not 0 <= probability <= 1:
            raise ValueError("Model returned invalid probability")
        level = (
            "high"
            if probability >= thresholds["high"]
            else ("medium" if probability >= thresholds["medium"] else "low")
        )
        outputs.append(
            {
                "risk_probability": probability,
                "risk_level": level,
                "at_risk": probability >= thresholds["at_risk"],
                "support_level": {
                    "low": "doing_well",
                    "medium": "watch",
                    "high": "priority_support",
                }[level],
            }
        )
    return outputs
