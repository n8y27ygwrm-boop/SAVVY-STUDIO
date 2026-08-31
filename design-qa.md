# Savvy Studio — 03 Infrastructure Refinement Design QA

## Comparison target

- Directional source references:
  - `/private/var/folders/qx/412dcks54nnccj86_x9nnw3c0000gn/T/TemporaryItems/com.apple.Photos.NSItemProvider/uuid=8965A745-8FF8-44BA-8AF6-60847E0B4A2C&code=001&library=1&type=1&mode=1&loc=true&cap=true.png/Image 30.8.26 at 4.29 PM.png`
  - `/private/var/folders/qx/412dcks54nnccj86_x9nnw3c0000gn/T/TemporaryItems/com.apple.Photos.NSItemProvider/uuid=99BEE514-70EE-4DC0-A1FD-DA572BD61A5C&code=001&library=1&type=1&mode=1&loc=true&cap=true.png/Image 30.8.26 at 4.25 PM (1).png`
  - `/private/var/folders/qx/412dcks54nnccj86_x9nnw3c0000gn/T/TemporaryItems/com.apple.Photos.NSItemProvider/uuid=95CBEFA3-1AEC-45CB-BB20-8361C140D38E&code=001&library=1&type=1&mode=1&loc=true&cap=true.png/Image 30.8.26 at 4.25 PM.png`
- Local implementation: `http://127.0.0.1:8080/Savvy%20Studio%20Hero.dc.html?v=infra-refine`
- Source file: `Savvy Studio Hero.dc.html`
- Checkpoint baseline: `f498a1e21eee8013d1d691cd3e5a4af9bf21bb0a`
- Reference dimensions: 2940 × 1912 px each. The references include desktop/app chrome and are used directionally, not as literal pixel-match targets.
- Implementation viewports: desktop 1440 × 900 and 1280 × 720 CSS px, tablet 1024 × 768 CSS px, and mobile 390 × 844 CSS px.

## Full-view comparison evidence

- Combined reference/implementation input: `qa-evidence/infrastructure-refinement/reference-comparison.png`.
- Desktop six-beat sequence: `desktop-beat-1.png` through `desktop-beat-6.png`.
- Tablet issue-detail state: `tablet-beat-4.png`.
- Mobile summary, detail, and resolved states: `mobile-beat-1.png`, `mobile-beat-4.png`, and `mobile-beat-6.png`.
- Isolation evidence for untouched experiences: `01-unchanged.png` and `02-unchanged.png`.

## Focused visual findings

- Central hero: the initial iteration inherited too much of the low-opacity map reveal, making the control instrument insufficiently prominent in beat 1. The map floor was raised from 0.25 to 0.42 while keeping the surrounding build zones subdued. The control instrument is now legible from entry and remains the spatial anchor in every state.
- Generic-dashboard reduction: the previous equal-weight card field was replaced by one tall control instrument, a slim phase rail, four quiet structural zones, restrained dependency paths, and one reactive issue panel.
- State clarity: health, progress, blockers, warnings, connected systems, primary issue, and next action update together across red, amber, and green states. The final state names the remaining release-readiness warning instead of leaving resolved authentication as the primary issue.
- Mobile hierarchy: the first pass allowed the next-action text to collide with the grouped build zones. The control summary was increased to 270 px, grouped zones were moved below it, and the primary issue uses a compact single-line state on small screens. The issue detail opens as a bottom sheet.
- Overflow: the isolated 03 stage reports equal `scrollWidth` and `clientWidth` at 390 px. No 03 horizontal overflow was observed.

## Interaction and motion validation

- Six scroll beats render as distinct states at progress 0.04, 0.22, 0.39, 0.55, 0.73, and 0.91.
- The sticky 03 stage remains pinned at 1440 × 900 throughout the sequence.
- Reverse scroll from a resolved state back before the issue threshold clears `resolved`, closes the detail panel, removes focus, and restores the blocked state.
- Selecting the central primary issue or Authentication module opens the issue detail.
- Completing authentication changes the stage to resolved/healthy and updates health metrics and the remaining primary warning.
- Native button controls and visible `:focus-visible` states are preserved for keyboard operation.
- Reduced-motion rules keep the interface readable while collapsing CSS transitions and animation.
- Browser console: no warnings or errors recorded during the final 01, 02, and 03 checks.

## Responsive validation

- Desktop, 1440 × 900: all six states, issue panel, reverse scroll, and final healthy overview verified. The default 1280 × 720 preview was also checked with a compact control layout and non-overlapping caption.
- Tablet, 1024 × 768: central control remains dominant; detail panel opens at the right; map stays visible and no horizontal overflow was observed.
- Mobile, 390 × 844: top summary and phase strip appear first, central issue appears second, build areas are simplified into two columns, and detail uses a bottom sheet. The 03 stage reports `scrollWidth: 390` and `clientWidth: 390`.

## Isolation validation

- `01 · Intelligence` and `02 · Product` were reopened and rendered at their mid-sequence states after the 03 changes.
- The checkpoint diff contains new `bc-*` Infrastructure markup/styles and Infrastructure-only state handlers. No Intelligence or Product markup, copy, assets, or animation code was changed.
- THE SYSTEM overview was not modified.

## Source-level validation

- DC component script passes `node --check`.
- `support.js` passes `node --check`.
- `git diff --check` passes.
- The browser console is clean.

## Comparison history

### Iteration 1

- Built the central control instrument, left phase rail, four build zones, issue panel, dependency path, six states, and responsive reflow.
- P1 finding: beat 1 made the central control layer too dim.
- P1 finding: mobile next-action content collided with grouped build zones.

### Iteration 2

- Increased the map’s minimum visibility while retaining lower hierarchy for the surrounding zones.
- Increased the mobile control-summary height, moved grouped steps lower, and compacted the primary issue state.
- Updated the resolved primary issue to `Release readiness warning remains` so the final state truthfully shows one warning.
- Re-captured desktop, tablet, mobile, and reference-comparison evidence.

## Open questions

- None.

## Follow-up polish

- No additional visual polish is required for this pass.

final result: passed
