import hashlib
import json
import warnings
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.exceptions import InconsistentVersionWarning
from sklearn.pipeline import Pipeline
from sklearn.utils.validation import check_is_fitted

FORBIDDEN_FEATURES = {
    "at_risk",
    "risk_level",
    "risk_score",
    "student_names",
    "phone_no.",
    "student address",
    "roll no.",
    "school name",
    "comment",
    "weekly_feedback",
    "sentiment_label",
    "grade",
}
BACKEND_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class LoadedModel:
    pipeline: Pipeline
    metadata: dict
    feature_names: tuple[str, ...]
    artifact_path: str


def resolve_path(path: str | Path) -> Path:
    path = Path(path)
    return path if path.is_absolute() else BACKEND_ROOT / path


def load_model(artifact_path: str | Path, metadata_path: str | Path) -> LoadedModel:
    artifact_path, metadata_path = resolve_path(artifact_path), resolve_path(metadata_path)
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    for key in (
        "model_name",
        "model_version",
        "feature_version",
        "adapter_version",
        "feature_names",
        "thresholds",
        "sklearn_version",
        "artifact_sha256",
    ):
        if not metadata.get(key):
            raise ValueError(f"Model metadata missing {key}")
    if metadata["sklearn_version"] != sklearn.__version__:
        raise ValueError("Runtime scikit-learn version does not match pretrained artifact")
    if hashlib.sha256(artifact_path.read_bytes()).hexdigest() != metadata["artifact_sha256"]:
        raise ValueError("Pretrained artifact checksum does not match metadata")
    names = tuple(metadata["feature_names"])
    if (
        not names
        or len(set(names)) != len(names)
        or any(n.lower() in FORBIDDEN_FEATURES for n in names)
    ):
        raise ValueError("Invalid or forbidden feature names")
    thresholds = metadata["thresholds"]
    if not (
        0 <= thresholds["medium"] < thresholds["high"] <= 1 and 0 <= thresholds["at_risk"] <= 1
    ):
        raise ValueError("Invalid risk thresholds")
    # Only load this explicitly configured, trusted artifact. Never accept uploaded pickle files.
    with warnings.catch_warnings():
        warnings.simplefilter("error", InconsistentVersionWarning)
        model = joblib.load(artifact_path)
    if not isinstance(model, Pipeline):
        raise ValueError("Expected the supplied complete preprocessing Pipeline")
    check_is_fitted(model)
    if getattr(model, "n_features_in_", None) != len(names):
        raise ValueError("Model feature count mismatch")
    embedded_names = getattr(model, "feature_names_in_", None)
    if embedded_names is not None and tuple(embedded_names) != names:
        raise ValueError("Model feature ordering does not match metadata")
    if not callable(getattr(model, "predict_proba", None)) or list(model.classes_) != [0, 1]:
        raise ValueError("Expected binary predict_proba with classes [0, 1]")
    # Verify the existing fitted imputer can handle missing values. No fit/fit_transform calls.
    probe = pd.DataFrame([[np.nan] * len(names)], columns=names)
    probabilities = model.predict_proba(probe)
    if probabilities.shape != (1, 2) or not np.isfinite(probabilities).all():
        raise ValueError("Model failed probability smoke check")
    if not np.all((probabilities >= 0) & (probabilities <= 1)) or not np.allclose(
        probabilities.sum(axis=1), 1
    ):
        raise ValueError("Model returned invalid probabilities")
    return LoadedModel(model, metadata, names, str(artifact_path))
