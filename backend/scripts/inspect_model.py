"""Read the trusted supplied artifact and notebook. Never train or rewrite the model."""

import ast
import csv
import hashlib
import json
import os
from pathlib import Path

import joblib


def reference_root() -> Path:
    return Path(os.environ.get("MODEL_REFERENCE_ROOT", Path(__file__).resolve().parents[2]))


def notebook_feature_names(notebook: Path, dataset: Path) -> list[str]:
    cells = json.loads(notebook.read_text(encoding="utf-8"))["cells"]
    excluded = None
    for cell in cells:
        if cell["cell_type"] != "code":
            continue
        source = "".join(cell["source"])
        if "EXCLUDE =" not in source:
            continue
        tree = ast.parse(source)
        for node in tree.body:
            if isinstance(node, ast.Assign) and any(
                isinstance(target, ast.Name) and target.id == "EXCLUDE" for target in node.targets
            ):
                excluded = ast.literal_eval(node.value)
        expected = "FEATURES = [c for c in df.columns if c not in EXCLUDE]"
        if expected not in source:
            raise ValueError("Review changed notebook feature-selection logic")
    if excluded is None:
        raise ValueError("Notebook exclusions not found")
    with dataset.open(encoding="utf-8-sig", newline="") as file:
        columns = next(csv.reader(file))
    return [column for column in columns if column not in excluded]


def main() -> None:
    root = reference_root()
    artifact = root / "eduguard_risk_model.joblib"
    names = notebook_feature_names(
        root / "EduGuard_AI_Risk_Detection_Colab.ipynb", root / "student_dataset_enriched.csv"
    )
    model = joblib.load(artifact)
    assert list(model.feature_names_in_) == names
    assert model.n_features_in_ == len(names)
    print(
        json.dumps(
            {
                "object": type(model).__name__,
                "steps": [(n, type(s).__name__) for n, s in model.steps],
                "predict_proba": callable(getattr(model, "predict_proba", None)),
                "classes": model.classes_.tolist(),
                "feature_count": len(names),
                "feature_names": names,
                "sha256": hashlib.sha256(artifact.read_bytes()).hexdigest(),
                "notebook_order_matches_artifact": True,
                "custom_model_metadata_present": False,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
