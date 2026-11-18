---
version: 1
slug: "frontend-src-pages-teacher-dashboard-jsx"
primary_target: "frontend/src/pages/teacher/Dashboard.jsx"
related_targets:
  - "frontend/src/features/alerts/AlertFeed.jsx"
  - "frontend/src/features/students/AttentionTable.jsx"
---

## Mode

Operate.

## Direction contract

THESIS: Put human follow-through first. A teacher sees students to check in with, opens recorded evidence in place, and follows a review link into the student's context. Class records and raw weekly entry remain close at hand.

OWN-WORLD: The learning journal documented in DESIGN.md: warm paper, plum navigation and actions, Georgia headings, Segoe UI working text, lilac supporting surfaces, and text-labelled rust/ochre/sage states. Standard web controls carry the work.

FIRST VIEWPORT: Personal heading with refresh and, when a class is selected, Record this week. Below it, the cross-class check-in panel sits beside a check-in reminder and actual assigned classes. The class picture follows with a class selector, current observation date, five summary readings, and a searchable/filterable roster. This is not a sticky attention banner or a collection of catalogue cards.

SIGNATURE: Native evidence disclosures expand within a student row. They render supplied contributing factors, previous/current model estimates when available, and an optional supplied next step. Their advisory text and teacher-only footer remain visible in the relevant context. Missing evidence is explicitly stated.

BEHAVIOR: Filter buttons use pressed state and counts. Refresh and class changes preserve request ordering. Classes, signals, and summaries retain their own loading/error/empty handling where implemented. Student links preserve the course context. Never fabricate data for empty states.

RESPONSIVE: The main panel uses the flexible column and a 270px aside (320px at 1600px and above; compact adaptations at 1250px/1023px). Below 768px the overview stacks, with a two-column aside; at 480px the aside becomes one column and the reminder panel is hidden. Table overflow stays within its scroll region. The global drawer replaces the rail below 1024px.

GUARDRAILS: Teacher-only model output is an aid to judgment. Students never receive risk probabilities, risk levels, internal severity, or AI outputs. Synthetic demo examples are read-only and do not establish real-school validity. Preserve raw input contracts and existing routes. Documented visuals do not certify backend persistence or accessibility compliance.

SOURCE: `.impeccable/redesign-direction.md`, the current JSX files, and `frontend/src/index.css`. This brief describes the implemented JSX surface; the old TSX brief is a separate orphan and was not edited in this documentation pass.
