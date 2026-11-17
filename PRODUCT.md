# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Academic evaluators (decide success).** This is a minor project judged on its
  demo. Reviewers interact with demo accounts and synthetic data; the product's
  craft, honesty, and AI depth are the evidence being evaluated.
- **Teacher (primary in-product user).** Records raw weekly observations per
  student, runs risk inference, reads explanations, creates and tracks
  interventions.
- **School admin.** Manages structure (users, classes, subjects, offerings,
  enrollments), CSV imports, intervention templates, school settings.
- **Student.** Sees only their own progress, visible teacher actions, and goals —
  never any model output.

## Product Purpose

EduGuard is an early-warning academic-risk platform for schools. Teachers record
weekly raw observations (classes held/attended, assessment averages, assignment
counts, late submissions); a scikit-learn pipeline derives 40 temporal features
and produces a risk probability with a mapped support level; the signal becomes
a trackable support plan with an immutable sequenced intervention timeline.
Success on the demo means a reviewer sees trustworthy, explained, governed AI —
not a school-management system with a model bolted on.

## Positioning

Mechanisms a neighboring product could not truthfully copy:

- **Privacy enforced structurally, not by convention.** Student response schemas
  simply do not contain risk fields, and a dedicated test seeds hidden data and
  asserts it never leaks into any student response at any nesting depth.
- **Train/serve identity.** The same `app.ml.feature_builder` computes features
  for training and serving, so drift is impossible by construction.
- **Exact per-prediction explanations.** For the linear model, contributions are
  the exact logit identity (`coef × standardized value`) recomputed from the
  persisted snapshot — "0.62" becomes "attendance slope + late submissions drove
  this".
- **Tamper-evident model governance.** The loader refuses checksum mismatch,
  scikit-learn version drift, wrong feature ordering, out-of-range thresholds —
  a broken model can never silently produce scores.
- **Honesty as a feature.** The README documents what the model cannot do; a
  risk platform that overstates itself is treated as worse than one that admits
  its edges.

## Operating Context

- Demo runs locally: backend via `backend/start.ps1` (Python 3.12 venv), API at
  `127.0.0.1:8000`, frontend at `localhost:5173` (Vite).
- Demo accounts: school slug `demo`; `admin@demo.edu`, `teacher@demo.edu`,
  `student@demo.edu` (+2 students); password `EduGuard-Demo-2026!`.
- Demo data comes from `scripts/seed_demo` and `scripts/seed_frontend_demo` so
  every dashboard shows populated states.
- Model artifact is retrained in-repo: `generate_synthetic_weekly` (800–1600
  synthetic students, 14 weeks, five personas) → `train_model --overwrite`
  (compares LR / HistGB / RF with GroupKFold by student; thresholds derived from
  out-of-fold probabilities).

## Capabilities and Constraints

**Confirmed capabilities:** 60 API operations across 11 route modules
(`/api/v1`); three roles (admin / teacher / student) with RBAC; multi-tenant
with composite FK tenancy enforced by PostgreSQL; weekly single/batch entry with
CSV import; risk inference with per-feature contributions and a counterfactual
what-if simulator (nothing persisted); AI alert feed (declining / needs_support
/ new_data / improving); risk trajectory chart; intervention templates and
tracking; student progress, goals, and visible-actions views.

**Binding constraints:**
- Raw weekly observations are the only teacher input; no derived or ML feature
  is ever accepted as input.
- Risk probabilities, risk levels, and internal severity are never exposed to
  students; AI outputs (what-if, copilot-style text) are teacher-only.
- The risk signal is a teacher-facing aid, not a verdict shown to a child.
- scikit-learn pinned at 1.6.1; Python 3.12/3.13 (the artifact does not load
  under 3.14).

**Known validity limits (must not be papered over):** the shipped model is
trained on synthetic data whose labels come from the same generator as the
observations; out-of-fold metrics (ROC-AUC 0.9999) bound the pipeline, not
real-school performance. Nothing in the system is a diagnosis — it flags a
trajectory for a human to look at.

**Deliberately undecided / open (tracked in `PLAN.md`, not committed):** A3
sentiment classifier, A4 forecast cone, B1–B4 learning-loop/MLOps surfaces
(feedback retraining, PSI drift, registry UI, model card), C1–C4 stretch items
(k-NN similarity, anomaly detector, LLM copilot, archetypes). Milestone gaps:
M17 v2 ensemble blocked; M18 calendar not started; M19 hardening partial (no
login rate limiting, no password reset, no secrets-management story); M20
acceptance test unwritten.

## Brand Commitments

- **Name:** EduGuard.
- **Voice:** plain, precise, honest about limitations; the README's
  "Known limitations" register is part of the brand.
- **Privacy rule:** binding always — risk scores/probabilities never visible to
  students; AI outputs teacher-only. Confirmed permanent, not demo-scoped.

## Evidence on Hand

- Retrained model artifact (`backend/artifacts/eduguard_risk_model.joblib`,
  untracked) with tracked `model_metadata.json` (version, checksum, thresholds,
  OOF metrics, provenance).
- Original notebook `EduGuard_AI_Risk_Detection_Colab.ipynb` kept for
  provenance; `student_dataset_enriched.csv` for provenance checks only.
- Full README set: root, backend (API reference + ops), frontend (routes),
  FEATURES.md (40 feature formulas), IMPORTS.md (CSV contract), PLAN.md (AI/ML
  roadmap), SUMMARY.md (repository analysis).
- Test suites: backend 130 tests against real PostgreSQL; frontend 47 tests via
  Vitest/RTL/MSW.
- **Absences that future work must not fabricate:** no real-school data, no
  customers, no testimonials, no press, no deployment claims. The model has
  never run on real student records.

## Product Principles

1. **Aid, not verdict.** The risk signal is a teacher-facing aid, never a
   verdict shown to a child — enforced structurally, not by UI convention.
2. **Every AI output is grounded.** Explanations and simulations derive only
   from persisted snapshots and recorded inputs; never invent data a model did
   not actually use.
3. **Honesty over impressiveness.** State validity limits plainly; never
   overstate what the model can do.
4. **Raw in, signal out.** Teachers enter only raw weekly observations; all
   derivation happens in the audited feature builder shared by training and
   serving.
5. **The demo leads with the AI.** Insights, explanations, forecasting, and
   governance are the headline; management screens are supporting cast.

## Accessibility & Inclusion

Target: **WCAG 2.1 AA** (confirmed). Existing practice uses `aria-label`,
`role`, visually-hidden text, labelled inputs, and a `prefers-reduced-motion`
block; the known gap — loading/error states announce via `role="status"`
rather than a dedicated `aria-live` region — is a real defect against this
target, not an acceptable trade.
