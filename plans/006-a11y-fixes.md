# Plan 006: Fix the three real accessibility defects (collapsed accordion exposure, menu keyboard support, misused aria-label)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 762e2c2..HEAD -- src/components/ui.tsx src/components/sections.tsx`
> If either file changed since this plan was written (plan 005 restructures
> sections.tsx — coordinate via plans/README.md status), compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none strictly; if plan 005 is IN PROGRESS, land it first
  (both edit sections.tsx/ui.tsx — the excerpts below are from the
  planned-at commit and survive plan 005's split, but line numbers move)
- **Category**: bug (accessibility)
- **Planned at**: commit `762e2c2`, 2026-07-12

## Why this matters

The site is otherwise a11y-conscious (sr-only h1, aria-labelledby sections,
reduced-motion handling, focus-visible styles), but three defects undercut
it for assistive-tech users: (1) collapsed Experience bios remain fully
exposed to screen readers, so `aria-expanded` lies about state; (2) the
theme dropdown claims `role="menu"` semantics but implements none of the
required keyboard behavior; (3) the Japanese signature carries an
`aria-label` on a plain `<p>`, which is prohibited ARIA usage on a generic
role and unreliably announced. The owner's positioning (HCI background,
siteboard audits accessibility) makes shipped a11y bugs a credibility cost
beyond their user impact.

## Current state

All excerpts from commit `762e2c2`:

- `src/components/ui.tsx:256-280` — `ExpRow`; the body is always present:

  ```tsx
  <button className="rrow exp-head" aria-expanded={!!open} onClick={onToggle}>
    ...
  </button>
  <div className="exp-body">
    <div className="exp-inner">{children}</div>
  </div>
  ```

  Collapse is purely visual (`grid-template-rows: 0fr` + `overflow: hidden`,
  see `src/styles/site.css:281-289`) — the text stays in the accessibility
  tree. There are no focusable elements inside the bodies today (plain
  `<p>` content), so `aria-hidden` is safe.

- `src/components/ui.tsx:99-149` — `ThemeMenu`: trigger button with
  `aria-haspopup="menu"`, popup `<div className="menu" role="menu">`
  containing three `role="menuitemradio"` buttons. Existing behavior:
  outside-mousedown closes, Escape closes, no arrow keys, no focus
  management on open/close.
- `src/components/sections.tsx:151-158` — Signature:

  ```tsx
  <p className="signature" lang="ja"
    aria-label="Boku wa Yo desu. Demo hontou wa Mi desu.">
    <Greeting lang="ja" />、<ruby>僕<rt>ぼく</rt></ruby>は<span className="kana">よ</span>です。でも<ruby>本当<rt>ほんとう</rt></ruby>は<span className="kana">み</span>です。
  </p>
  ```

- Conventions: hooks-based function components, 2-space indent, single
  quotes, comments explain *why* (match the file's existing style).
- Verification harness (plan 001): `npm run check`, `npm run test`.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Install   | `npm install`    | exit 0              |
| Typecheck | `npm run check`  | 0 errors            |
| Tests     | `npm run test`   | all pass            |
| Build     | `npm run build`  | exit 0              |
| Dev       | `npm run dev`    | serves localhost:4321 |

## Scope

**In scope** (the only files you should modify):
- `src/components/ui.tsx` (ExpRow, ThemeMenu)
- `src/components/sections.tsx` (Signature only)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- CSS files — the 0fr collapse animation stays exactly as is.
- `RowList`, `Contact`, `Greeting`, or any other component.
- The `Experience` state model (single-open accordion behavior stays).
- Adding an a11y test framework (axe etc.) — manual checklist below.

## Git workflow

- Branch: `advisor/006-a11y-fixes`
- One commit per fix is ideal (three small commits).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Hide collapsed accordion bodies from assistive tech

In `ExpRow` (ui.tsx):

1. Give the body a stable id derived from the row: add a `co` -based slug or
   use React's `useId()` (preferred — no collision logic):

   ```tsx
   const bodyId = React.useId();
   ```

2. Wire the relationship and state:

   ```tsx
   <button className="rrow exp-head" aria-expanded={!!open}
     aria-controls={bodyId} onClick={onToggle}>
   ...
   <div className="exp-body" id={bodyId} role="region" aria-hidden={!open}>
   ```

   Keep the class names and structure otherwise identical (the CSS animation
   depends on `.exp-body > .exp-inner`).

**Verify**: `npm run check` → 0 errors. In `npm run dev`, inspect the DOM:
collapsed rows have `aria-hidden="true"`, the open row `aria-hidden="false"`,
and toggling updates both attributes.

### Step 2: Give ThemeMenu real menu keyboard behavior

Keep the roles (menu/menuitemradio are appropriate for a radio-group
dropdown); add the missing behavior inside `ThemeMenu`:

1. Collect item refs: `const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);`
   and assign `ref={el => { itemRefs.current[i] = el; }}` on each item.
2. When the menu opens, focus the active item (fall back to the first):
   `React.useEffect(() => { if (open) itemRefs.current[activeIdx >= 0 ? activeIdx : 0]?.focus(); }, [open]);`
   where `activeIdx` is the index of the currently selected theme in `opts`.
3. Add `onKeyDown` on the `.menu` container: ArrowDown/ArrowUp move focus to
   the next/previous item with wrap-around; Home/End jump to first/last;
   Tab closes the menu (let the default move focus on); all handled keys call
   `e.preventDefault()` except Tab.
4. When the menu closes via Escape or item selection, return focus to the
   trigger button (add a `btnRef` on the trigger; call
   `btnRef.current?.focus()` in those paths — NOT on outside-click close,
   which would steal focus from wherever the user clicked).

**Verify**: `npm run check` → 0 errors. Manual keyboard walkthrough in
`npm run dev` (record each): Tab to the toggle → Enter opens and focus lands
on the checked item → arrows cycle with wrap → Enter selects, menu closes,
focus returns to the toggle → reopen, Escape closes, focus returns to the
toggle → open, click elsewhere closes without focus jump.

### Step 3: Fix the Signature labeling

In `sections.tsx`, remove the `aria-label` attribute from the signature
`<p>` entirely. The element already carries `lang="ja"`; screen readers
switch synthesizers on `lang` and read the ruby-annotated text natively —
that is more accurate than a stale romaji transliteration glued to a
generic-role element (ARIA prohibits naming generic/paragraph roles).

Resulting element (unchanged otherwise):

```tsx
<p className="signature" lang="ja">
  <Greeting lang="ja" />、<ruby>僕<rt>ぼく</rt></ruby>は<span className="kana">よ</span>です。でも<ruby>本当<rt>ほんとう</rt></ruby>は<span className="kana">み</span>です。
</p>
```

**Verify**: `grep -n 'aria-label' src/components/sections.tsx` → the only
remaining matches (if any) are NOT on the signature paragraph;
`grep -n 'Boku wa' src/` → no matches.

## Test plan

- `npm run test` (plan-001 suite) must pass — no behavioral overlap expected.
- The step-2 keyboard walkthrough is the acceptance test; paste the completed
  checklist into your report.
- Optional spot-check with a screen reader if available (VoiceOver/NVDA):
  collapsed bios are not announced when reading the page linearly; the menu
  announces "menu, 3 items" and selection state.

## Done criteria

Machine-checkable where possible. ALL must hold:

- [ ] `npm run check`, `npm run test`, `npm run build` all exit 0
- [ ] `grep -n 'aria-controls' src/components/ui.tsx` → ≥ 1 match in ExpRow
- [ ] `grep -n 'aria-hidden={!open}' src/components/ui.tsx` → 1 match
- [ ] `grep -n 'Boku wa' src/` → no matches
- [ ] ThemeMenu contains ArrowDown/ArrowUp/Home/End handling (grep for `'ArrowDown'`)
- [ ] Keyboard walkthrough checklist completed and reported
- [ ] `git status --porcelain` shows changes ONLY in the in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The ExpRow/ThemeMenu code no longer matches the excerpts (plan 005 moved
  or reshaped them) AND the mapping to the new location is not obvious —
  report the new shape instead of guessing.
- Anyone has added focusable elements (links) inside `.exp-body` since the
  planned-at commit — `aria-hidden` on content containing focusables is a
  WCAG failure; the fix would then need `inert` instead, which has React
  version implications. Report, don't switch approach silently.
- Step 2's focus management fights React re-renders (focus visibly flickers)
  — report with the observed behavior.

## Maintenance notes

- If Experience bios ever gain links (`.exp-more` styles exist in site.css
  for exactly that), the `aria-hidden` in step 1 must be upgraded to `inert`
  (React 19 supports the `inert` prop natively; on React 18 it needs the
  attribute-string workaround). Leave a one-line code comment on the
  `aria-hidden` noting this.
- Reviewers: confirm no CSS changed and the accordion animation still runs;
  check the outside-click close path does NOT return focus to the trigger.
- Deferred: `hidden="until-found"` for searchable collapsed content —
  nice-to-have, browser support was the reason for deferral.
