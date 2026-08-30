# Product Design QA — 03 · Infrastructure

## Evidence

- Source visual truth: `/private/tmp/savvy-infrastructure-baseline.png`, captured from the existing Savvy Studio system overview before the Infrastructure walkthrough was implemented.
- Source pixels / CSS viewport / density: `1458 × 833` px / `1458 × 833` CSS px / `1x`.
- Browser-rendered implementation: `/private/tmp/savvy-infrastructure-after-01.png` through `/private/tmp/savvy-infrastructure-after-06.png`.
- Implementation pixels / CSS viewport / density: `1458 × 833` px / `1458 × 833` CSS px / `1x` in the selected Chrome session.
- Full-view combined comparison: `/private/tmp/savvy-infrastructure-qa-comparison.png` (`1458 × 1678` px), with the source capture above the final trusted-baseline implementation.
- Focused combined comparison: `/private/tmp/savvy-infrastructure-qa-focus.png` (`1220 × 1272` px), comparing the source Infrastructure card's typography, palette, and restraint against the implemented certainty-frontier caption, topology, and inspector.
- Compared scroll states: `0.08`, `0.22`, `0.38`, `0.58`, `0.82`, and `0.96` across the `620vh` sticky scene.
- Normalization: source and implementation were captured from the same selected browser at the same viewport and density. No resampling was needed in the full-view comparison. The focused crop was scaled only to make small type and state-color relationships legible.
- Scope note: the source capture defines Savvy's visual language, not an exact Infrastructure topology layout. The implementation is therefore judged for continuity of typography, palette, rhythm, editorial restraint, and interaction quality rather than false pixel parity with a non-existent state mock.

## Findings

No actionable P0, P1, or P2 findings remain.

- Fonts and typography: editorial captions use Bodoni Moda with the same light optical treatment as the system cards; interface and body copy use Manrope; topology labels use a compact mono stack. The hierarchy remains legible without making the technical layer feel like the Product dashboard.
- Spacing and layout rhythm: the persistent shell, hierarchy rail, central topology, inspector, decision surface, history strip, and six caption positions share the existing site's restrained margins and thin-rule rhythm. The inspector transition preserves the active frontier and adjacent nodes.
- Colors and visual tokens: near-black surfaces, ivory context, muted grey unknowns, amber uncertainty/frontier, crimson decision action, and muted green demonstrated state are consistent and semantically stable across all six beats.
- Image quality and asset fidelity: the Infrastructure experience contains no supplied hero artwork or raster product screenshot. The SVG is the live semantic topology itself—nodes, directed boundaries, and proof state—not a fabricated decorative asset. Existing Savvy imagery and the Product raster assets remain untouched.
- Copy and content: all six requested captions are exact. Claim, observed evidence, gap, risk, verification objective, required evidence, authorized/prohibited actions, stop condition, returned evidence, human decision, and final metrics are present and coherent.
- Icons and controls: the new scene avoids a competing icon family. Boundary IDs, evidence rows, hierarchy levels, and decision actions use native buttons with visible hover/focus treatments and descriptive labels where the compact boundary ID alone would be ambiguous.
- States and interactions: seven boundary buttons expose contract detail; B-05 opens the claim inspector; evidence rows emphasize the frontier; Accept, Request More, and Defer retain selected state; accepted evidence turns B-05 demonstrated and moves the amber frontier to B-06.
- Scroll and reversibility: the six windows map to `0–14`, `14–29`, `29–46`, `46–65`, `65–83`, and `83–100`. Reverse scrolling from the resolved state back through `0.58`, `0.22`, and `0.08` retracts the inspector, proof matrix, frontier, IDs, and accepted state in the correct order.
- Accessibility: the scene exposes semantic button controls, aria-labels for all boundary targets, `:focus-visible` treatments, pointer-event gating for hidden panels, and a dedicated `prefers-reduced-motion` rule. The desktop test has zero horizontal overflow.
- Regression: Back to the System restores the three-card overview and collapses the expanded section to `0px`. Intelligence still opens exclusively with its existing video scene; Product still opens exclusively with FieldTrack, and all three Product images load at native intrinsic dimensions.

## Comparison History

### Pass 1 — blocked

- [P2] The claim inspector covered too much of the downstream topology and clipped the active frontier label.
  - Fix: introduced a shared topology x-offset and applied it consistently to the SVG, boundary targets, and frontier label while the inspector is open.
  - Post-fix evidence: `/private/tmp/savvy-infrastructure-after-04.png` keeps Source Eligibility, B-05, Bonus Extraction, and the frontier label visible beside the claim inspector.
- [P2] The final top bar allowed the outgoing `PARTIAL` status, incoming demonstrated status, and metrics to collide.
  - Fix: reserved a stable evidence-status slot, anchored the incoming label, and switched the evidence dot to green after acceptance.
  - Post-fix evidence: `/private/tmp/savvy-infrastructure-after-06.png` shows a clean `DEMONSTRATED` status plus the five requested final metrics without overlap.

### Pass 2 — passed

- `/private/tmp/savvy-infrastructure-qa-comparison.png` confirms continuity with the current Savvy visual language at the full-view level.
- `/private/tmp/savvy-infrastructure-qa-focus.png` confirms the display typography, thin crimson rules, near-black/ivory balance, mono technical layer, and restrained amber frontier treatment at readable scale.
- `/private/tmp/savvy-infrastructure-after-01.png` through `/private/tmp/savvy-infrastructure-after-06.png` show one persistent topology changing state rather than six replacement screens.
- No P0/P1/P2 visual or interaction issue remains.

## Primary Verification

- Six scroll checkpoints and exact captions: passed.
- Eight topology nodes and seven interactive boundaries: passed.
- B-05 computed certainty frontier and claim inspector: passed.
- Verification brief and four progressive evidence rows: passed.
- Human decision controls and accepted-state transition: passed.
- B-05 green / B-06 amber frontier migration: passed.
- Final metrics `7 / 24 / 18 / 3 / 1`: passed.
- Reverse-scroll restoration: passed.
- Back-to-system restoration: passed.
- Intelligence and Product scene isolation: passed.
- Product image regression: `3/3` images complete.
- Desktop horizontal overflow: `0px`.
- Browser diagnostic log after reload and state exercise: `[]`.

## Follow-up Polish

- P3: tune individual progress thresholds after stakeholder review on a physical trackpad.
- P3: capture and visually review the existing mobile media-query treatment in a resizable selected-browser session; the responsive and reduced-motion code paths are present, but this pass was visually captured only at the selected desktop viewport.

## Final Result

final result: passed
