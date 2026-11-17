# EduGuard presentation content

## Slide 1: EduGuard: Early-Warning Academic-Risk Detection and Intervention Platform for Schools

**Subtitle:** Undergraduate Minor Project Evaluation

- Educational Data Mining and Machine Learning
- Full-Stack Multi-Tenant Web Systems

**Visual / diagram suggestion:** Minimal navy title slide with an editable project title and presenter details.

**Speaker notes:** EduGuard connects weekly academic observations with teacher review and trackable support. Its central design principle is to keep risk advisory and teacher-facing while giving students a positive view of their progress.


## Slide 2: Introduction and abstract

**Subtitle:** A closed loop linking early signals to educator action

- Weekly observations reveal changing academic patterns before final outcomes.
- EduGuard combines longitudinal prediction with teacher review and recorded support.
- Follow-up observations help teachers review progress after an intervention.

**Visual / diagram suggestion:** Five connected stages with a follow-up return path beneath them.

**Speaker notes:** Early-warning research links longitudinal indicators with opportunities for timely support. EduGuard implements that idea as a complete workflow in which teachers interpret signals, act, and review subsequent progress.

**Sources:**

- Balfanz, R., Herzog, L., & Mac Iver, D. J. (2007). Preventing student disengagement and keeping students on the graduation path in urban middle-grades schools: Early identification and effective interventions. Educational Psychologist, 42(4), 223–235. https://doi.org/10.1080/00461520701621079
- Baker, R. S. J. d., & Yacef, K. (2009). The state of educational data mining in 2009: A review and future visions. Journal of Educational Data Mining, 1(1), 3–17. https://doi.org/10.5281/zenodo.3554657

## Slide 3: Problem statement and relevance

**Subtitle:** Schools need timely evidence and a responsible path to action

- Reactive support starts after visible failure or disengagement.
- A single grade hides direction, volatility and repeated missed work.
- Fragmented records separate evidence from intervention follow-up.
- Student-facing risk labels can undermine privacy and encourage fixed judgments.

**Visual / diagram suggestion:** Four paired rows linking an existing problem to EduGuard’s design response.

**Speaker notes:** The problem is both analytical and operational: schools need to notice change and coordinate a response. The student experience also matters, because predictive labels can create stigma when treated as fixed judgments.

**Sources:**

- Balfanz, R., Herzog, L., & Mac Iver, D. J. (2007). Preventing student disengagement and keeping students on the graduation path in urban middle-grades schools: Early identification and effective interventions. Educational Psychologist, 42(4), 223–235. https://doi.org/10.1080/00461520701621079
- Slade, S., & Prinsloo, P. (2013). Learning analytics: Ethical issues and dilemmas. American Behavioral Scientist, 57(10), 1510–1529. https://doi.org/10.1177/0002764213479366

## Slide 4: Objectives of the project work

**Subtitle:** Five SMART acceptance targets for the minor-project evaluation

- By evaluation, demonstrate school isolation with composite school_id relationships and rejected cross-tenant access.
- By evaluation, derive the fixed 40-feature contract from dated weekly records with deterministic missing-data handling.
- By evaluation, validate the serialized pipeline and map teacher-only probabilities to the three stated risk bands.
- By evaluation, demonstrate intervention creation, status updates and a reviewable timeline in the teacher portal.
- By evaluation, demonstrate student progress, streaks and supportive actions with zero risk fields in student responses.

**Visual / diagram suggestion:** Five numbered objectives, each with a concrete demonstration or acceptance condition.

**Speaker notes:** Each objective has a defined evaluation deadline and an observable acceptance condition. Together they cover tenant isolation, repeatable inference, teacher action, and a protected student experience.


## Slide 5: Requirements and literature survey

**Subtitle:** Selected EWS and EDM research informs the system requirements

- Functional: ingest weekly records, predict, explain and track interventions.
- Non-functional: tenant isolation, role privacy, repeatability, responsiveness and testability.

**Visual / diagram suggestion:** Editable comparison table above two concise requirement groups.

**Speaker notes:** Longitudinal monitoring and intervention are established ideas in early-warning research. EduGuard’s contribution is their integration with tenant-safe storage and a deliberately restricted student view, rather than a claim that all existing systems lack these capabilities.

**Sources:**

- Balfanz, R., Herzog, L., & Mac Iver, D. J. (2007). Preventing student disengagement and keeping students on the graduation path in urban middle-grades schools: Early identification and effective interventions. Educational Psychologist, 42(4), 223–235. https://doi.org/10.1080/00461520701621079
- Baker, R. S. J. d., & Yacef, K. (2009). The state of educational data mining in 2009: A review and future visions. Journal of Educational Data Mining, 1(1), 3–17. https://doi.org/10.5281/zenodo.3554657
- Romero, C., & Ventura, S. (2020). Educational data mining and learning analytics: An updated survey. WIREs Data Mining and Knowledge Discovery, 10(3), e1355. https://doi.org/10.1002/widm.1355
- Slade, S., & Prinsloo, P. (2013). Learning analytics: Ethical issues and dilemmas. American Behavioral Scientist, 57(10), 1510–1529. https://doi.org/10.1177/0002764213479366

## Slide 6: System design and architecture

**Subtitle:** Three layers with shared-database tenant integrity

- API authorization scopes requests by role, school and course assignment.
- Composite (school_id, entity_id) foreign keys reject cross-school relationships.
- Database integrity complements application authorization in a shared database.

**Visual / diagram suggestion:** Editable three-tier architecture with the scikit-learn pipeline attached to the service layer.

**Speaker notes:** React presents role-specific workflows while FastAPI validates and authorizes requests before accessing school-scoped data. Composite tenant foreign keys prevent invalid cross-school relationships, while the API remains responsible for restricting reads.

**Sources:**

- C:/Users/Airbone/Desktop/minor_project/01_BACKEND_ARCHITECTURE.md
- C:/Users/Airbone/Desktop/minor_project/backend/app/ml/model_loader.py

## Slide 7: Research methodology and ML pipeline

**Subtitle:** Dated feature construction and reproducible advisory inference

- Build features only from observations available on or before the prediction date.
- Verify the artifact checksum, feature ordering, runtime version and threshold metadata.
- Evaluate predictive quality separately from software tests before school deployment.

**Visual / diagram suggestion:** Three feature families followed by the native preprocessing pipeline and non-overlapping probability bands.

**Speaker notes:** The implementation uses an eight-week observation window and preserves missing values for the fitted imputer. The risk bands are configured decision rules, and the measured explanation signals do not establish causation or calibrated predictive accuracy.

**Sources:**

- C:/Users/Airbone/Desktop/minor_project/backend/app/ml/feature_builder.py
- C:/Users/Airbone/Desktop/minor_project/backend/app/ml/model_loader.py
- C:/Users/Airbone/Desktop/minor_project/backend/app/services/explanation_service.py

## Slide 8: Tools and technologies used

**Subtitle:** A typed application stack with explicit data and security boundaries

- The stack supports typed interfaces, repeatable database evolution and reproducible model inference.

**Visual / diagram suggestion:** A six-category editable technology grid.

**Speaker notes:** The frontend handles role-specific workflows, and FastAPI enforces the data contract at the service boundary. PostgreSQL constraints, model verification and separate backend and frontend tests support reliability.


## Slide 9: Ethical AI and privacy by design

**Subtitle:** Role-specific information supports care without exposing predictive labels

- Risk probabilities and levels remain teacher-facing advisory aids.
- Student responses exclude risk scores, labels and disciplinary judgments.
- Human review and dated observations reduce deterministic labeling.
- Bias prevention requires subgroup evaluation and ongoing monitoring.

**Visual / diagram suggestion:** A role-partition matrix paired with a clearly marked remaining fairness-validation requirement.

**Speaker notes:** Students see measured progress, streaks and supportive actions, while authorized teachers see advisory risk signals and private intervention details. This design reduces exposure and labeling risks, but fairness requires empirical checks and cannot be guaranteed by hiding scores.

**Sources:**

- Slade, S., & Prinsloo, P. (2013). Learning analytics: Ethical issues and dilemmas. American Behavioral Scientist, 57(10), 1510–1529. https://doi.org/10.1177/0002764213479366
- Miao, F., Holmes, W., Huang, R., & Zhang, H. (2021). AI and education: Guidance for policy-makers. UNESCO. https://doi.org/10.54675/PCSP7350
- C:/Users/Airbone/Desktop/minor_project/backend/PROGRESS.md

## Slide 10: Progress of project work

**Subtitle:** Current status reported in the project brief

- Responsive Admin, Teacher and Student portals are complete.
- Model verification includes checksum and threshold validation.
- Passing software tests do not establish predictive accuracy or intervention effectiveness.

**Visual / diagram suggestion:** Completed milestone matrix with separate backend test and frontend suite counts.

**Speaker notes:** The reported implementation covers the backend, three responsive portals and the temporal inference workflow. These figures document engineering progress, while predictive validation and real-school outcomes require separate evidence.


## Slide 11: Screenshots and working modules

**Subtitle:** Four interface placeholders for the live demonstration

- Teacher class risk summary and distribution chart.
- Student risk factor breakdown in the teacher portal.
- Intervention creation and timeline tracker.
- Growth-oriented student dashboard.

**Visual / diagram suggestion:** Four screenshot layout boxes. Insert actual application captures in the indicated areas before presenting a screenshot-based demonstration.

**Speaker notes:** The demonstration moves from the teacher’s class overview to an individual student’s measured signals, then records and reviews an intervention. The final view switches to the student portal, where only growth and supportive actions appear.


## Slide 12: Work to be done and future scope

**Subtitle:** Proposed roadmap beyond the current minor-project implementation

- v2 stacked ensemble using XGBoost and RandomForest.
- Student check-in sentiment NLP classifier.
- Google Calendar synchronization for meetings.
- Production rate-limiting and password reset.

**Visual / diagram suggestion:** Sequenced roadmap with validation gates separating reliability work from experimental model additions.

**Speaker notes:** The roadmap first strengthens evaluation and deployment readiness, then extends integration and modeling. Any ensemble or sentiment model should demonstrate measurable benefit and meet the same privacy boundaries before release.


## Slide 13: References and bibliography

**Subtitle:** Academic foundations in EWS, Educational Data Mining and ethical AI

- Early Warning Systems: longitudinal indicators and intervention.
- EDM: modeling and analytics foundations.
- Ethical AI: privacy, agency and human oversight.

**Visual / diagram suggestion:** Five APA-style references in a single readable column, with DOI links retained in the speaker notes.

**Speaker notes:** These references establish the foundations for early-warning indicators, educational data mining and responsible use of learner data. EduGuard applies them through its longitudinal workflow, teacher oversight and restricted student views.

**Sources:**

- Balfanz, R., Herzog, L., & Mac Iver, D. J. (2007). Preventing student disengagement and keeping students on the graduation path in urban middle-grades schools: Early identification and effective interventions. Educational Psychologist, 42(4), 223–235. https://doi.org/10.1080/00461520701621079
- Baker, R. S. J. d., & Yacef, K. (2009). The state of educational data mining in 2009: A review and future visions. Journal of Educational Data Mining, 1(1), 3–17. https://doi.org/10.5281/zenodo.3554657
- Romero, C., & Ventura, S. (2020). Educational data mining and learning analytics: An updated survey. WIREs Data Mining and Knowledge Discovery, 10(3), e1355. https://doi.org/10.1002/widm.1355
- Slade, S., & Prinsloo, P. (2013). Learning analytics: Ethical issues and dilemmas. American Behavioral Scientist, 57(10), 1510–1529. https://doi.org/10.1177/0002764213479366
- Miao, F., Holmes, W., Huang, R., & Zhang, H. (2021). AI and education: Guidance for policy-makers. UNESCO. https://doi.org/10.54675/PCSP7350
