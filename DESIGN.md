---
name: EduGuard
description: The learning journal — clear observations, considered support, human follow-through
colors:
  paper: "#f8f7f4"
  surface: "#fff"
  ink: "#342737"
  muted: "#716966"
  rule: "#e3dfda"
  plum: "#49344c"
  plum-deep: "#352638"
  lilac: "#eee8f0"
  sage: "#326143"
  sage-wash: "#edf4ef"
  rust: "#963d2e"
  rust-wash: "#fbefea"
  ochre: "#7e591e"
  ochre-wash: "#fbf4e6"
  primary-hover: "#624969"
  focus: "#8c6293"
  evidence: "#f6f2f7"
  chart-purple: "#69517b"
  chart-green: "#39714e"
typography:
  display:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "clamp(30px, 2.7vw, 40px)"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-1.1px"
  headline:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "28px"
    fontWeight: 400
  title:
    fontFamily: '"Segoe UI", Arial, sans-serif'
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "-0.3px"
  body:
    fontFamily: '"Segoe UI", Arial, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: '"Segoe UI", Arial, sans-serif'
    fontSize: "12px"
    fontWeight: 600
  metric:
    fontFamily: '"Segoe UI", Arial, sans-serif'
    fontSize: "31px"
    fontWeight: 550
    lineHeight: 1.3
    letterSpacing: "-0.8px"
rounded:
  badge: "5px"
  control: "6px"
  navigation: "7px"
  lg: "8px"
  panel: "12px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "24px"
  xl: "28px"
  gutter: "38px"
components:
  button-primary:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.plum}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  button-secondary-hover:
    backgroundColor: "{colors.lilac}"
  login-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 13px"
    height: "46px"
  navigation-active:
    backgroundColor: "#efe7f1"
    textColor: "{colors.plum}"
    rounded: "{rounded.navigation}"
    padding: "11px 14px"
  status-critical:
    backgroundColor: "{colors.rust-wash}"
    textColor: "{colors.rust}"
    rounded: "{rounded.badge}"
    padding: "4px 8px"
  signal-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  evidence-content:
    backgroundColor: "{colors.evidence}"
    rounded: "{rounded.control}"
    padding: "18px"
  metric:
    textColor: "{colors.ink}"
    typography: "{typography.metric}"
---

# Design System: EduGuard

## Overview

**Creative North Star: "The learning journal"**

EduGuard uses the quiet clarity of academic editorial design: warm paper, deep plum, generous Georgia headings, and precise sans-serif controls. The interface gives people and their observations room to be read while keeping records, evidence, and actions close together.

The system is calm and practical. Fine rules and pale washes organize information; conventional navigation, tables, forms, and native disclosures carry the work. The journal is expressed through typography and spacing, without inventing unfamiliar controls or decorative imagery.

**Key Characteristics:**
- Warm paper and white surfaces with a deep plum navigation rail.
- Georgia headings paired with Segoe UI controls and tabular working numbers.
- Ruled records, softly rounded panels, and restrained lilac emphasis.
- Text-labelled rust, ochre, and sage states.
- Evidence revealed in place with native disclosures.
- Plain language that preserves human judgment and student privacy.

This document records the implemented replacement for the retired Signal Index world. Source authority is `frontend/src/index.css`, shared components, and `.impeccable/redesign-direction.md`; page strategy lives in surface briefs. Tokens above are normative; the sidecar adds preview snippets and non-token metadata.

## Colors

### Primary

**Plum** carries primary actions and links. **Deep plum** anchors the navigation and login story. **Lilac** is a quiet selected-state and supporting surface; it does not imply urgency. Primary hover and focus are distinct, so keyboard position is visible independently of selection.

### Secondary

**Rust** marks a check-in or critical support signal, **ochre** a watch or support-planning state, and **sage** improvement or ongoing positive progress. Pair each with its named wash and a text label. Purple and green chart series belong to assessment/assignment and attendance observations respectively; do not substitute chart color for a label or legend.

### Neutral

**Paper** is the page ground, **surface** the white working panel, **ink** the main text, **muted** secondary copy, and **rule** the structural divider. Tailwind's slate, amber, emerald, and red theme ramps in the stylesheet are coordinated with these families; preserve those mappings when using existing utility-built screens.

**The Named State Rule.** Every support state is named in text; color and icons supplement that name.

## Typography

Georgia with Times New Roman fallback gives page headings and selected section headings an editorial voice. Segoe UI with Arial fallback handles body text, forms, navigation, tables, and numbers. No downloaded font is required. Monospace (`ui-monospace, Consolas, monospace`) is reserved for technical identifiers and selected chart values already using it.

The display token describes the fluid desktop page title; mobile page titles are explicitly set to 33px. Section headings use either the serif headline or the compact sans title according to the existing hierarchy. Body copy uses the body token, with descriptive copy capped at 65ch. Labels use sentence case. Metrics and tables use tabular numerals; numeric table cells align right.

Functional component text varies from 11–15px, with some secondary mobile metadata at 10px. This is an extraction of the current implementation, not a claim that every surface has passed an accessibility audit. WCAG 2.1 AA remains the product target.

**The Reading Order Rule.** Use heading size and space to establish hierarchy; keep operational labels quiet and readable.

## Layout

The desktop shell has a fixed 232px rail, a 69px topbar, and a centered main region capped at 1600px with 38px padding. At 1250px and below, the rail narrows to 210px and main padding to 28px. At 1023px and below, navigation moves into a native dialog drawer (290px, capped at 88vw). At 767px and below, main padding is 25px 18px and the topbar is 59px tall.

Use the shared page header, then task-specific regions separated by whitespace and fine rules. Dashboard composition is documented in its surface brief. Metric strips use five desktop columns and three mobile columns; they are divided readings rather than individual floating cards. Record tables keep horizontal overflow inside their own scroll regions, including on narrow phones. Forms wrap actions and controls rather than forcing the page wider.

The login layout uses two equal desktop columns and stacks at the mobile breakpoint. Native responsive behavior and existing route structure take precedence over metaphor.

## Elevation & Depth

Working panels rest flat: white surfaces, pale washes, and fine borders provide separation. Small Tailwind shadow tokens are neutralized in the shared theme. Dialogs use the implemented overlay lift (`0 24px 80px #241c2738`) and a dark translucent backdrop (`#241c2780`); existing chart tooltips may retain their utility shadow. Do not apply overlay elevation to routine cards.

**The Quiet Surface Rule.** Establish ordinary hierarchy with spacing, rules, and tone; reserve pronounced elevation for content floating above the page.

## Shapes

Outer panels and dialogs use the panel radius. Controls and evidence interiors use the control radius; navigation uses its own slightly softer radius. Status labels use the badge radius, while person initials sit in circles. The brand mark retains its asymmetric corners. Borders are generally one pixel; active tabs use a two-pixel underline.

## Components

### Buttons and links

Primary and outlined secondary buttons share compact sans labels, an eight-pixel icon gap, and a 42px base minimum height. The application main-region selector currently overrides generic button minimum height to 36px; padding can make the rendered control taller. Login submit remains 46px. Primary hover deepens the plum; secondary hover fills lilac. Text links underline on hover. Disabled controls reduce opacity and use the unavailable cursor. Preserve explicit loading labels when an action is pending.

### Inputs and navigation

The login input token records the 46px field with a light border; general text inputs and selects have a 40px minimum. Inputs keep visible labels and meaningful errors. Focus-visible uses a three-pixel purple outline offset by three pixels. The global focus treatment also applies to links, buttons, summaries, and tab controls.

Navigation links are 46px minimum-height rows on the plum rail. The active link has a pale background and plum text. On smaller screens, the menu button opens the native drawer; preserve its close action, focus behavior, and accessible name. A skip link becomes visible on focus.

### Panels, state labels, and metrics

White signal and roster panels enclose ruled rows with no resting shadow. State chips combine readable names with the semantic color families. The shared support badge is a related bordered variant using theme ramps; its labels distinguish priority support, watch, doing well, and not assessed. Metrics remain typographic, with a label and optional explanatory detail.

### Evidence disclosure

Native details and summary reveal a pale evidence interior next to the student review action. Expanded content shows available recorded contributing factors and model estimates, plus an advisory reminder. A suggested next step appears only when supplied by the data. Missing factors receive an explicit empty message; do not invent explanations. Opening uses a 220ms ease-out fade and three-pixel movement. General state transitions last 160ms. Reduced-motion preference reduces animations and transitions to .01ms and disables smooth scrolling.

### Dialogs, feedback, and charts

Shared dialogs use a 540px maximum width constrained by the viewport and an 88dvh maximum height. Loading skeletons, empty states, and error panels have distinct explanatory copy and retry or recovery actions where implemented. Preserve status announcements and chart value-table disclosures when extending screens. Chart series represent supplied observations or explicitly supplied projections; visual capability is not evidence of a deployed forecasting service.

## Do's and Don'ts

### Do:
- **Do** use the shared tokens, page headers, controls, and state components across roles.
- **Do** keep support states text-labelled and keyboard focus visible.
- **Do** keep evidence beside the teacher's review action and identify model output as advisory.
- **Do** preserve reduced-motion behavior and contain wide records within table scroll regions.
- **Do** label synthetic, read-only demo data clearly and keep validity limits honest.

### Don't:
- **Don't** expose risk probabilities, risk levels, internal severity, or teacher-only AI outputs in student views.
- **Don't** present a signal as a diagnosis, verdict, or demonstrated real-school performance.
- **Don't** replace raw weekly observation fields with derived model features.
- **Don't** invent observations, evidence, customers, testimonials, deployment claims, or unimplemented product capabilities.
- **Don't** reintroduce the retired catalogue tabs, vermilion action palette, or stamped micro-label system.
