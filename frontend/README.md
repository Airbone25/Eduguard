# EduGuard Frontend — Academic Early-Warning Signal Ledger

A distinctive, high-density academic early-warning interface built specifically for educators and administrators. EduGuard turns weekly observations into mathematically explained risk trajectories, providing clear evidence slips, counterfactual simulations, and structured intervention tracking.

## Architecture & Framework

- **Skeleton**: Fresh Vite + React 19 + JavaScript (ES Modules).
- **Styling**: Tailwind CSS v4 with bespoke institutional design tokens (Scholar Ledger palette, high-contrast hairlines, tabular numerics).
- **State & Data**: `@tanstack/react-query` with optimistic cache invalidation, session token rotation, and robust offline mock fallback for immediate evaluator review.
- **Visualizations**: `recharts` for longitudinal risk trajectories, forecast confidence intervals, weekly progress trends, and support distributions.
- **Icons**: `lucide-react` for crisp institutional iconography.

## Design Philosophy: "The Academic Signal Ledger"

1. **Aid, Not Verdict**: The AI model flags trajectories for human educators to assess; it is never a verdict shown to a child.
2. **Structural Privacy**: Privacy is enforced by design. Students see only their own positive progress, streaks, goals, and visible interventions — never risk scores, probabilities, or severity classifications.
3. **Mathematical Attribution**: Predictions are explained using exact logit contributions (`coef × standardized_value`), showing educators exactly which factors (attendance slope, late submissions, quiz volatility) moved the score.
4. **Counterfactual Exploration**: Teachers can interact with a live What-If simulator to test how improved attendance or submission rates shift risk before committing an intervention.
5. **Ergonomic Data Entry**: Teachers can rapidly enter weekly records in a keyboard-friendly table with session draft preservation and CSV import.

## Evaluator Quick Logins

| Role | Email | Password | Primary Routes |
| :--- | :--- | :--- | :--- |
| **Teacher** | `teacher@demo.edu` | `EduGuard-Demo-2026!` | `/teacher/dashboard`, `/teacher/classes`, `/teacher/interventions` |
| **Admin** | `admin@demo.edu` | `EduGuard-Demo-2026!` | `/admin/dashboard`, `/admin/teachers`, `/admin/imports`, `/admin/settings` |
| **Student** | `student@demo.edu` | `EduGuard-Demo-2026!` | `/student/dashboard`, `/student/progress`, `/student/goals` |

*School slug*: `demo`

## Development Scripts

```bash
# Run local dev server (port 5173)
npm run dev

# Production build check
npm run build

# Preview production build
npm run preview
```
