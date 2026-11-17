---
name: EduGuard
description: Early-warning academic-risk platform — an indexed, explainable, teacher-facing signal system
colors:
  stock: "#f7f5ef"
  card: "#fffdf7"
  drawer: "#f2efe6"
  rail: "#23271f"
  rail-raised: "#2e332a"
  rail-line: "#3a3f37"
  ink: "#20241f"
  ink-2: "#52574d"
  ink-3: "#74796e"
  rule: "#ded9cd"
  rule-strong: "#c9c3b3"
  stamp: "#b23a2b"
  stamp-deep: "#8d2c20"
  stamp-wash: "#f9ece6"
  ochre: "#8f6a16"
  ochre-wash: "#f8f1de"
  sage: "#3e6b4f"
  sage-wash: "#eaf2e8"
  critical: "#a6281c"
  critical-wash: "#fbe9e5"
  neutral-wash: "#eeece4"
  chart-ink: "#20241f"
  chart-ochre: "#a3672a"
  chart-grid: "#e7e2d6"
  focus: "#8f6a16"
  call-number: "#6f7468"
  plate: "#e8e2cf"
  plate-ink: "#6b6450"
typography:
  display:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "30px"
    fontWeight: 650
    lineHeight: "1.2"
    letterSpacing: "-0.03em"
  metric:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "34px"
    fontWeight: 650
    lineHeight: "1"
    letterSpacing: "-0.04em"
    fontFeature: "tabular-nums"
  title:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: "1.4"
  body:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "1.6"
  small:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "1.6"
  label:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: "1.4"
    letterSpacing: "1.4px"
    textTransform: "uppercase"
  call:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
    fontSize: "11px"
    fontWeight: 400
rounded:
  tab: "3px"
  chip: "4px"
  input: "6px"
  button: "6px"
  card: "4px"
  panel: "6px"
  overlay: "10px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "20px"
  xl: "28px"
  gutter: "34px"
components:
  button-primary:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.card}"
    rounded: "{rounded.button}"
    padding: "9px 14px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.stamp-deep}"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "9px 14px"
    height: "38px"
  button-ghost:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.button}"
    padding: "9px 14px"
    height: "38px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "9px 12px"
    height: "40px"
  index-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    borderColor: "{colors.rule}"
    tabHeight: "22px"
  pull-slip:
    backgroundColor: "{colors.drawer}"
    rounded: "{rounded.tab}"
    ruleColor: "{colors.rule}"
  nav-item-active:
    backgroundColor: "{colors.rail-raised}"
    textColor: "{colors.card}"
---

# Design System: EduGuard

## Overview

**Creative North Star: "The Signal Index"**

EduGuard looks like a well-kept card catalogue in a school library: warm stock
paper, charcoal ink, hairline rules, and one vermilion stamp that marks
everything requiring a human decision. A teacher does not face a wall of
charts or a gradebook; they face a ranked drawer of student signals. Each
signal is an indexed card with a small classification tab — priority, watch,
improving, not assessed. Pull the card and a stamped evidence slip explains,
in the model's own exact terms, why it was filed there and what action is
yours to take. The visual system is an instrument of filing and explanation,
not of spectacle.

The research behind this world is consistent across public AI-education and
learning-analytics references: conclusion-first layouts, a tight set of
decision-linked metrics, familiar bar/line charts, visible comparison and
trend, traffic-light states that never rely on color alone, explainable AI
framed as an analyst rather than an oracle, and explicit human-in-the-loop and
privacy cues. Teachers prefer simple charts even when denser ones carry more
information; therefore the charts here stay ordinary and the distinctiveness
lives in the filing grammar — tabs, slips, call numbers, ruled rows.

**Key characteristics:**
- Warm catalogue stock and card white; charcoal rail; one vermilion stamp accent.
- Ranked, finite index cards with classification tabs and pull-slip evidence.
- Hairline rules and tonal washes provide all depth; shadows only on overlays.
- 10–14px humanist sans, 34px tabular numerals, monospace call numbers.
- Ochre for watch, sage for improving, vermilion for priority and critical — always with a text label.
- Governance printed on the shell: advisory, teacher-only, never a verdict, never student-facing.

## Research basis

This system replaces the earlier "Field Notebook" world. Mobbin was unavailable
(paid MCP plan), so the reference set came from public sources: AI learning
analytics dashboards (8allocate, Springer systematic review), teacher-facing
LAD research (DashED, FeedBook, TEADASH, Mejia-Domenzain et al. 2026), the
evulpo Class Hub case study, the Razzmic K-12 analytics case study, a school
leadership command-center case study, UQ's Student Experience AI Dashboard,
and SaaS KPI/analytics pattern guides. Their shared lessons became rules below:
lead with the answer; pair every number with a comparison; use familiar charts;
show evidence next to AI output; label synthetic/demo data; keep the human in
control; never expose risk to students.

## Colors

### The ground and the ink
- **Catalogue Stock** (`#f7f5ef`): the page canvas — warm, matte, unbleached.
- **Card White** (`#fffdf7`): every index card, panel, input, and table surface; a shade warmer than paper white.
- **Drawer** (`#f2efe6`): secondary bands, table headers, open pull slips, and inactive tabs.
- **Rail Charcoal** (`#23271f`): navigation rail and topbar, with raised `#2e332a` and rule `#3a3f37`.
- **Ink** (`#20241f`): headings and primary text; **Ink 2** (`#52574d`) body copy; **Ink 3** (`#74796e`) the contrast floor for secondary copy.
- **Rule** (`#ded9cd`) and **Rule Strong** (`#c9c3b3`): 1px hairlines only.

### The stamp and the classifications
- **Vermilion Stamp** (`#b23a2b`): the one live accent — primary buttons, active marker, priority tab, onset dots, focus-adjacent emphasis; hover deepens to `#8d2c20`, wash `#f9ece6`.
- **Ochre** (`#8f6a16`): watch classification on `#f8f1de`; the focus ring also uses this hue.
- **Sage** (`#3e6b4f`): improving classification on `#eaf2e8`.
- **Critical Red** (`#a6281c`) on `#fbe9e5`: validation, destructive actions, and the sharpest risk state — text and border only, never a full flood.
- **Unfiled** (`#eeece4` with ink-3 text): the not-assessed state.

### Data and punctuation
- **Chart Ink** (`#20241f`): observed series and bars. **Chart Ochre** (`#a3672a`): projected/uncertainty series. **Chart Grid** (`#e7e2d6`): axes and gridlines. A single vermilion dot marks the week a trajectory changed; never a second accent color.
- **Borrower Plate** (`#e8e2cf` with `#6b6450` text): avatar circles, keeping people distinct from data.
- **Call Number** (`#6f7468`, monospace): entity IDs, snapshot dates, and record codes.

### Named rules
**The Stock Rule.** Light surfaces are warm and matte; the rail is the only dark region. Ink lives on stock, never the reverse — on the rail, text is card-white or its dimmed family.
**The Labelled Stamp Rule.** A state is a tab or badge whose text names the state; color is never the sole carrier. Classifications are always one of priority, watch, improving, unfiled.

## Typography

One family, no webfont: "Segoe UI" with system fallbacks. It keeps numbers native and precise; weight and tight tracking do the emphasis work. `ui-monospace` appears only for call numbers. No eyebrow kicker sits above a heading — headings carry their own weight; stamped labels belong on cards, tabs, and controls.

- **Display** (650, 30px, 1.2, -0.03em): page h1.
- **Metric** (650, 34px, 1, -0.04em, tabular): advisory values and card headline numbers; always paired with a comparison or window.
- **Title** (650, 16px, 1.4): panel and card headings.
- **Body** (400, 13px, 1.6): paragraphs, forms, and recommendations; measure capped at 75ch.
- **Small** (400–650, 11px, 1.6): tables, tabs, badges, secondary copy.
- **Label** (700, 10px, uppercase, 1.4px): control labels, classification tabs, stamped metadata.
- **Call** (400, 11px, monospace): IDs and record codes.

### Named rules
**The Tabular Rule.** Every aligned number, table column, and metric uses tabular numerals; right-align amounts and totals.
**The Fixed-Scale Rule.** Type sizes are fixed, not fluid — this is a working instrument at a known DPI. Ratio steps stay between 1.125 and 1.2 outside the metric/display pair.

## Layout

Fixed charcoal rail (228px; 204px ≤1280px; 184px ≤1024px; hidden ≤767px in favor of a 280px sheet). Paper topbar 72px (64px mobile) with breadcrumb left, governance stamp and account right. Main canvas centered at `max-width: 1600px`, padding 28px 34px (20px 18px mobile). Following the research, the first viewport is conclusion-first: sticky attention band → ranked signal index → compact metric strip → charts/tables below.

Rhythm: 20–28px between page regions, 10–14px inside data regions. Metric strip is 5-up desktop → 3-up ≤1024px → 2-up mobile. Detail grids 2-col → 1-col ≤600px. Breakpoints: 1600 / 1280 / 1024 / 767 / 600.

## Elevation & Depth

Depth is physical but flat: stacked sheets of stock separated by 1px rules and tonal washes. Resting cards take no shadow. Only overlays lift.

- **Overlay lift** `0 18px 60px #1c201a38` for modals and sheets.
- **Slip edge** `0 1px 0 var(--rule)` for an open pull slip — a rule, not a shadow.
- No translate-on-hover, no glow, no zero-blur colored halos.

## Shapes

Corners are tight and paper-like: 3px tabs, 4px chips and cards, 6px inputs/buttons/panels, 10px overlays, 50% avatars. Classification tabs sit at the card's top-right edge as a 22px stamped chip — never a colored left border. Rules are always 1px and drawn in the rule family.

## Components

### Buttons
6px radius, 38px min-height, 9px 14px padding, 12px/700 label, 8px icon gap. Primary is a vermilion stamp fill with card-white text, deepening on hover; outline is card-white with ink text and a rule border; ghost is transparent with ink-2 text. Danger text links are the only other red use. Every state — hover, focus, active, disabled, loading, error — is designed.

### Index Card (signature)
A card-white sheet, 4px radius, 1px rule, 16px padding. Its top-right carries a 22px classification tab: priority (vermilion), watch (ochre), improving (sage), unfiled (neutral). Header row holds the student name, a monospace call number, and a right-aligned snapshot date. One line states the change in plain language; a right-aligned metric shows the value and its comparison. Nothing decorative is added to make it look "data-like".

### Pull Slip (signature)
Each index card ends with a stamped disclosure labelled "Why this card was pulled". Opening it reveals a drawer-toned slip: the exact contributing factors from the persisted prediction, each with its signed contribution and a plain-language label, followed by "Suggested next step" and the governance line "Advisory. You decide." The slip is native `<details>`/`<summary>` — accessible, keyboard-operable, and never a modal.

### Attention Band
Sticky below the topbar: paper ground, a vermilion tab marker, an uppercase label, a monumental tabular count, and a jump link. On student routes the marker is charcoal; the band never turns into a traffic-light billboard.

### Metric Cards
Card-white, 4px radius, rule border, 16px padding. Label 10px uppercase; value 34px tabular with -0.04em tracking; comparison in 11px with an explicit window ("vs last 4 weeks"). Direction and sentiment are separate: the arrow shows movement, the hue shows whether that movement is good for this metric.

### Tables
11px (12px ≥1600px); header 10px/700 uppercase on Drawer with hairline top/bottom; cells 16px 14px padded, ink-2 text, hairline dividers; row hover `#f4f1e8`; numbers tabular and right-aligned; first/last cells get 22px inset.

### Charts
Recharts rendered on card white with chart-grid axes, chart-ink observed series, chart-ochre projected area, and one vermilion onset dot. Bar charts use chart-ink with a single highlighted category. Every chart keeps its accessible HTML values disclosure and `aria-hidden` plot, so the numbers remain available without color or hover.

### Badges, States, Overlays
Status badges: 4px chips, 10px/700 uppercase text on the matching wash, always with the state word. Skeletons pulse in Drawer tones; empty states use a Drawer plate with a short teaching sentence; errors are critical-wash cards naming the problem and the retry. Modals are card-white, 10px radius, scrim `#1c201a66`, and reserve focus properly.

### Browser surfaces
Selection, caret, scrollbars, focus ring, underline offset, and tabular numerals are themed from this palette. Focus is a 3px ochre ring with 2px offset on every interactive element; reduced motion disables transitions and reveals.

## Do's and Don'ts

### Do:
- **Do** file every signal into a ranked, finite index with a named classification tab.
- **Do** show the evidence slip next to the claim; every AI output cites the persisted factors it used.
- **Do** pair every metric with a comparison and an explicit time window.
- **Do** keep charts familiar and let the filing grammar carry the identity.
- **Do** print governance in the shell: teacher-only, advisory, never a verdict, never shown to a student.
- **Do** theme browser defaults and keep the amber/ochre focus ring visible everywhere.

### Don't:
- **Don't** reintroduce the retired evergreen palette, cool navy/yellow console, gradients, glows, or saturated page floods.
- **Don't** use color alone for risk: every tab and badge names its state.
- **Don't** put a shadow on a resting card, animate hover lifts, or use a colored left border as a classification.
- **Don't** use an eyebrow above a heading, a modal for a simple disclosure, or a decorative display face in UI labels.
- **Don't** reveal risk probabilities, percentages, or AI outputs to student-role surfaces — privacy is structural, not visual.
- **Don't** invent data the model did not use; demo data stays visibly synthetic.
