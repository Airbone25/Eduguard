import hashlib
import json
from dataclasses import replace
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest

from app.ml.feature_builder import build_features
from app.ml.inference import ordered_features, predict
from app.ml.model_loader import load_model
from scripts.inspect_model import notebook_feature_names, reference_root


@pytest.fixture(scope="module")
def model():
    return load_model("artifacts/eduguard_risk_model.joblib", "artifacts/model_metadata.json")


def test_original_artifact_and_exact_notebook_order(model):
    root = reference_root()
    expected = notebook_feature_names(
        root / "EduGuard_AI_Risk_Detection_Colab.ipynb", root / "student_dataset_enriched.csv"
    )
    assert list(model.feature_names) == expected
    assert len(expected) == model.pipeline.n_features_in_ == 40
    assert [type(step).__name__ for _, step in model.pipeline.steps] == [
        "SimpleImputer",
        "StandardScaler",
        "LogisticRegression",
    ]
    assert model.pipeline.classes_.tolist() == [0, 1]
    assert (
        hashlib.sha256((root / "eduguard_risk_model.joblib").read_bytes()).hexdigest()
        == model.metadata["artifact_sha256"]
    )
    assert (root / "eduguard_risk_model.joblib").read_bytes() == Path(
        model.artifact_path
    ).read_bytes()


def test_real_probability_ordering_and_fitted_missing_value_processing(model):
    built = build_features(
        [
            {
                "week_start": date(2026, 1, 5),
                "assessment_avg_score": 70,
                "classes_held": 10,
                "classes_attended": 8,
            }
        ],
        date(2026, 1, 5),
    )
    values = ordered_features(model, built, "MATH", "Mathematics")
    assert list(values) == list(model.feature_names)
    assert values["Math"] == 70
    assert values["Physics"] is None and values["Sentiment_Score"] is None
    assert values["Score_Change_4Wk"] is None
    assert predict(model, values) == predict(model, dict(reversed(list(values.items()))))
    assert 0 <= predict(model, values)["risk_probability"] <= 1
    frame = pd.DataFrame([[np.nan] * 40], columns=model.feature_names)
    np.testing.assert_allclose(
        model.pipeline.named_steps["imputer"].transform(frame)[0],
        model.pipeline.named_steps["imputer"].statistics_,
    )
    with pytest.raises(ValueError):
        predict(model, {**values, "At_Risk": 1})


@pytest.mark.parametrize(
    "probability,level,at_risk",
    [
        (0.3999, "low", False),
        (0.4, "medium", False),
        (0.5, "medium", True),
        (0.65, "high", True),
    ],
)
def test_threshold_boundaries(model, probability, level, at_risk):
    fake = replace(
        model,
        pipeline=SimpleNamespace(
            predict_proba=lambda frame: np.array([[1 - probability, probability]])
        ),
    )
    output = predict(fake, dict.fromkeys(model.feature_names))
    assert output["risk_level"] == level and output["at_risk"] is at_risk


@pytest.mark.parametrize("corrupt", ["order", "count", "sha", "version", "forbidden", "thresholds"])
def test_model_contract_failures(model, monkeypatch, corrupt):
    meta = json.loads(json.dumps(model.metadata))
    if corrupt == "order":
        meta["feature_names"].reverse()
    elif corrupt == "count":
        meta["feature_names"].pop()
    elif corrupt == "sha":
        meta["artifact_sha256"] = "0" * 64
    elif corrupt == "version":
        meta["sklearn_version"] = "0.0"
    elif corrupt == "forbidden":
        meta["feature_names"][0] = "At_Risk"
    else:
        meta["thresholds"]["medium"] = 0.9
    monkeypatch.setattr(Path, "read_text", lambda *a, **k: json.dumps(meta))
    with pytest.raises(ValueError):
        load_model(model.artifact_path, "artifacts/model_metadata.json")


def test_missing_artifact_fails():
    with pytest.raises(FileNotFoundError):
        load_model("artifacts/does-not-exist.joblib", "artifacts/model_metadata.json")
