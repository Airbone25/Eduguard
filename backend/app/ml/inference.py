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
    if set(values) != set(model.feature_names):
        raise ValueError("Input feature names do not match model")
    frame = pd.DataFrame(
        [[np.nan if values[name] is None else values[name] for name in model.feature_names]],
        columns=model.feature_names,
    )
    probability = float(model.pipeline.predict_proba(frame)[0, 1])
    if not math.isfinite(probability) or not 0 <= probability <= 1:
        raise ValueError("Model returned invalid probability")
    thresholds = model.metadata["thresholds"]
    level = (
        "high"
        if probability >= thresholds["high"]
        else ("medium" if probability >= thresholds["medium"] else "low")
    )
    return {
        "risk_probability": probability,
        "risk_level": level,
        "at_risk": probability >= thresholds["at_risk"],
        "support_level": {"low": "doing_well", "medium": "watch", "high": "priority_support"}[
            level
        ],
    }
