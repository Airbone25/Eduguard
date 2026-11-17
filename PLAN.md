# PLAN.md — AI/ML expansion roadmap

**Created:** 2026-11-17 · **Owner:** project author · **Horizon:** 1–3 months (solo)

## Why this plan exists

Reviewer feedback judged EduGuard as "a school management system, not an AI
project." The management scaffolding (tenants, RBAC, CSV imports, weekly-entry
forms) is necessary plumbing, but it currently dominates the surface. This plan
inverts the emphasis: every new feature adds a model, an explanation surface,
or a learning loop. After completion the demo leads with insights, forecasts,
model governance and copilots — management screens become supporting cast.

## Where we already are (shipped before this plan)

| Asset | Status |
|---|---|
| Risk model retrained end-to-end: `scripts/generate_synthetic_weekly.py` + `scripts/train_model.py` (features via production builder, GroupKFold by student, OOF metrics, thresholds derived from out-of-fold probabilities) | ✅ 2026-11-17 |
| Model registry supports version swap; tamper detection preserved | ✅ 2026-11-17 |
| AI alert feed on teacher home (`GET /teacher/alerts`: declining / needs_support / new_data / improving) | ✅ 2026-11-17 |
| Risk trajectory chart on student Overview | ✅ 2026-11-17 |
| Existing: explanations, recommendations, interventions, snapshots, audit | ✅ |
| **A1** per-prediction feature contributions (`app/ml/explain.py`, exact logit identity, imputer drop-column handling) + signed bars UI | ☑ 2026-11-17 |
| **A2** what-if simulator (`POST /teacher/predictions/what-if`, whitelist + ranges, nothing persisted) + slider panel UI | ☑ 2026-11-17 |

## Roadmap

Status legend: ☐ pending · ◐ in progress · ☑ shipped

### Tier 1 — explainability & forecasting (highest demo impact)

| # | Feature | Why it lands | Effort | Status |
|---|---|---|---|---|
| A1 | **Per-prediction "why flagged" contributions** — for the linear risk model the attribution is exact: `contribution_i = coef_i × standardized_value_i`, computed from the persisted snapshot. Top positive/negative drivers shown as signed bars on the prediction card. | Turns "0.62" into "attendance slope + late submissions drove this" — the signature trustworthy-AI moment. | 2 d | ☑ 2026-11-17 |
| A2 | **Counterfactual what-if simulator** — sliders over interpretable model features (attendance, scores, lateness, LMS use) recompute probability live via `POST /predictions/what-if` using the stored snapshot; never persisted. | Judges interact with the model directly; makes the decision boundary tangible. | 2 d | ☑ 2026-11-17 |
| A3 | **Sentiment classifier for check-in notes (2nd model)** — Milestone 16 already captures text without a classifier. Fine-tune DistilBERT (or TF-IDF+LR fallback); sentiment *trend* becomes an alert-feed signal; raw risk stays hidden from students. | Adds a genuinely separate model; fixes a documented gap. | 3–4 d | ☐ |
| A4 | **4-week risk forecast with uncertainty cone** — gradient-boosting model on lag features (or forward-simulated LR), shaded projection band on the existing trajectory chart. | "Early warning" literally means forecasting; one dramatic chart. | 3 d | ☐ |

### Tier 2 — MLOps / learning loop

| # | Feature | Why it lands | Effort | Status |
|---|---|---|---|---|
| B1 | **Human-in-the-loop feedback + retraining loop** — Confirm/Dismiss on alert feed items store teacher labels; trainer merges them as weak labels; retrain banner shows "updated from N teacher confirmations." | Closing the loop is the most ML-engineering thing in the demo. | 3 d | ☐ |
| B2 | **Drift monitoring (PSI)** — per-feature population stability index computed weekly from snapshots; `/admin/model-health` page with sparklines; flags shift → suggests retrain. | Pure NumPy, reads as production MLOps. | 2 d | ☐ |
| B3 | **Model registry UI** — version list, metric comparison bars, Promote/Rollback (`is_active` already supports it); ROC/PR/calibration curves generated at train time. | Model governance made visible. | 2 d | ☐ |
| B4 | **Auto-generated model card** — render `model_metadata.json` + `training_report.json` (metrics, threshold derivation, provenance, limitations) as a model-card page. | Zero ML work, pure credibility. | 1 d | ☐ |

### Tier 3 — more models & smarter recommendations

| # | Feature | Why it lands | Effort | Status |
|---|---|---|---|---|
| C1 | **Student similarity engine (k-NN over feature vectors)** — "students like Riya improved most with attendance-focused plans"; case-based intervention recommendation. | Recommendations get real ML behind them. | 3 d | ☐ |
| C2 | **Engagement anomaly detector** — IsolationForest on week-over-week deltas; "unusual week" badges on the alert feed. | Third model; catches abrupt behavior change when scores still look fine. | 2 d | ☐ |
| C3 | **LLM teacher copilot (cloud API)** — NL queries over alert-service JSON + snapshot explanations ("Who in 9B needs attention and why?"); auto-drafted weekly digests / parent notes, teacher-visible only, explicitly reviewed before use. | The visible "AI" people expect; grounded, not decorative. | 4 d | ☐ |
| C4 | **KMeans student archetypes** — cluster the feature space into personas; labels on student pages; cluster-aware recommendations; PCA 2-D projection plot for the report. | Memorable chart; reframes "students" as data. | 2 d | ☐ |

## Build order

- **Weeks 1–2 (this sprint):** A1 + A2 — explainability core.
- **Week 3:** A3 sentiment model.
- **Week 4:** B1 + B2 — learning loop + drift.
- **Week 5:** A4 forecast cone (fallback: C2).
- **Week 6:** B3 + B4 — governance surfaces.
- **Stretch:** C3 copilot, C1 similarity, C4 archetypes.

End state: 4–5 models (risk LR, sentiment, forecaster/anomaly detector,
clustering), exact per-prediction explanations, active-learning loop, drift
monitoring, model governance UI, grounded LLM copilot.

## Sprint design notes — A1 + A2

**A1 (contributions)**
- New `app/ml/explain.py`: `feature_contributions(model, snapshot_features)`
  → per-feature `{name, value, contribution}` sorted by |contribution|;
  exact for linear models (`coef_ × scaled value`, intercept reported);
  graceful fallback to `feature_importances_` if a retrain ships a tree model.
- Wired into the prediction detail response; contributions are recomputed at
  read time from the stored snapshot, so they always reflect the *current*
  model re-evaluating the *exact* recorded inputs.
- Tests: contributions + intercept reproduce `decision_function` (logit
  identity); missing features use the fitted imputer's value; ordering.
- UI: signed horizontal bars (red = increases risk, green = decreases) under
  the prediction result, friendly feature labels, "(imputed)" annotation.

**A2 (what-if)**
- `POST /api/v1/predictions/what-if` body `{prediction_id, overrides}` —
  whitelist of intuitive features only, sane numeric ranges; reuses the
  prediction's stored snapshot, applies overrides, runs the standard ordered
  inference path; returns `{baseline, probability, support_level, delta}`.
- Nothing persisted; explicitly a simulator.
- UI: appears on the prediction card after an insight exists; 5–6 sliders
  with current value + live delta readout and band change.
- Tests: monotonic probability response to attendance override; whitelist
  rejection; authorization (teacher outside course → 404).

**Constraints that do not change**
- Raw weekly observations remain the only teacher input; no ML features ever
  accepted as input.
- Risk scores/probabilities stay invisible to students; LLM outputs are
  teacher-only.
- Every feature ships with backend + frontend tests and a README touch;
  suites run once per feature (no verification loops).
