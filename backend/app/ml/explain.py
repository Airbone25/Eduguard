"""Per-prediction feature attributions for the loaded risk model.

For a linear classifier the attribution is exact: with z the standardized
(imputed) feature vector, log-odds = intercept + sum(coef_i * z_i), so
`coef_i * z_i` is feature i's exact contribution to the decision. Contributions
plus the intercept always reproduce `decision_function`, which is asserted in
tests — the explanation cannot silently drift from the prediction.

For a non-linear winner (histogram gradient boosting, random forest) exact
additive attribution is not available from the fitted object alone, so the
fallback reports `feature_importances_ * z_i` — an approximate, sign-aware
influence readout flagged with `exact=False`.
"""

import numpy as np
import pandas as pd

from app.ml.model_loader import LoadedModel


def retained_feature_names(model: LoadedModel) -> list[str]:
    """Feature names the classifier actually sees.

    SimpleImputer silently drops columns that had no observed values during
    fit (e.g. Sentiment_Score when sentiment is never captured), so the
    transformed vector is shorter than model.feature_names and the classifier
    coefficient vector aligns only with the retained columns.
    """
    statistics = getattr(model.pipeline.steps[0][1], "statistics_", None)
    if statistics is None:
        return list(model.feature_names)
    dropped = {model.feature_names[i] for i, value in enumerate(statistics) if np.isnan(value)}
    return [name for name in model.feature_names if name not in dropped]


def feature_contributions(
    model: LoadedModel, values: dict[str, float | None]
) -> dict:
    if set(values) != set(model.feature_names):
        raise ValueError("Input feature names do not match model")
    frame = pd.DataFrame(
        [[np.nan if values[name] is None else values[name] for name in model.feature_names]],
        columns=model.feature_names,
    )
    pre = model.pipeline[:-1]
    transformed = np.asarray(pre.transform(frame)[0], dtype=float)
    names = retained_feature_names(model)
    if len(names) != transformed.shape[0]:
        raise ValueError("Could not align transformed features with model inputs")
    classifier = model.pipeline.steps[-1][1]
    if hasattr(classifier, "coef_"):
        coefficients = np.asarray(classifier.coef_[0], dtype=float)
        contributions = coefficients * transformed
        intercept = float(classifier.intercept_[0])
        logit = float(contributions.sum() + intercept)
        exact = True
    elif hasattr(classifier, "feature_importances_"):
        contributions = np.asarray(classifier.feature_importances_, dtype=float) * transformed
        intercept = None
        logit = None
        exact = False
    else:
        raise ValueError("Model does not expose per-feature attributions")
    order = np.argsort(-np.abs(contributions))
    return {
        "exact": exact,
        "intercept": intercept,
        "logit": logit,
        "contributions": [
            {
                "name": names[index],
                "value": values[names[index]],
                "contribution": float(contributions[index]),
            }
            for index in order
        ],
    }
