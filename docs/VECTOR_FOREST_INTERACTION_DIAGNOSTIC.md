# Vector Forest interaction bug — diagnostic report

**Scope:** Diagnosis only (no fixes applied in this document).  
**Context:** After interacting with a slider on the Vector Forest page, many interactions stop working (e.g. tree → inspector, inspector close). Users also report **top navigation** (Dashboard, Forest Modification, Generalize Area, etc.) failing in some cases. **Scenario**, **Reset View**, and **Fullscreen** often still work — an important clue.

---

## 1) Working controls (after slider use)

### Scenario (collapsed)

| Field | Detail |
|--------|---------|
| **File** | `web/src/components/vector-forest/ScenarioCarousel.tsx` |
| **DOM** | Native `<button type="button">` |
| **`data-ui-overlay`** | Yes (`data-ui-overlay="true"`) |
| **Position / layer** | `position: absolute`, `z-[250]`, `m-3`, top-left — **child of `VectorForestScene` scene root**, **not** inside the pannable `div` |
| **Events** | `onClick` only (expand carousel) |
| **Pan system** | `handleScenePointerDown` bails out when `target.closest('[data-ui-overlay="true"]')` — this control **never starts** pan / `panStartRef` from that target |

### Reset View

| Field | Detail |
|--------|---------|
| **File** | `web/src/components/vector-forest/VectorForestScene.tsx` |
| **DOM** | Native `<button type="button">` |
| **`data-ui-overlay`** | Yes |
| **Position / layer** | `absolute bottom-3 left-3 z-[250]` — **direct child of scene root**, **sibling of** the pannable `absolute inset-0` layer (listed **before** that layer in the DOM) |
| **Events** | `onClick` → `handleResetView` |
| **Pan system** | Same early return as other overlays — **not** treated as “background” for pan |

### Full screen

| Field | Detail |
|--------|---------|
| **File** | `web/src/app/vector-forest/page.tsx` |
| **DOM** | Native `<button type="button">` |
| **`data-ui-overlay`** | Yes |
| **Position / layer** | `absolute right-3 bottom-[4.25rem] z-[250]` — **not inside `VectorForestScene` at all**; sibling of `containerRef` (forest), under `fullscreenRef` |
| **Events** | `onClick` → `toggleFullscreen` |
| **Pan system** | **No** `onPointerDown/Move/Up` on this element; it is **outside** the scene root that owns pan logic |

**Shared pattern (working trio):** all are **native buttons**, **`data-ui-overlay="true"`**, **`z-[250]`**, and either **outside the transformed pan subtree** entirely (fullscreen) or **above** it in stacking (Scenario / Reset: `z-250` vs pan layer with implicit stacking so the pan layer and its trees sit **below** 250 within the scene root). All are explicitly **excluded** from starting pan via the overlay `closest(...)` check.

---

## 2) Failing / fragile interactions (after slider use)

### Tree click → open inspector

| Field | Detail |
|--------|---------|
| **File** | `web/src/components/vector-forest/VectorForestScene.tsx` (mapped `<button>` list) |
| **DOM** | Native `<button>` with `data-tree-click="true"` |
| **`data-ui-overlay`** | No — uses **`data-tree-click`** instead |
| **Position / layer** | Inside **`div.absolute.inset-0`** with **`transform: translate(pan.x, pan.y)`** — **pannable layer** |
| **z-index** | `Math.floor(depth * 100)` or `200` when selected — always **below 250** vs overlay chrome |
| **Events** | **`onClick`** calls `handleTreeClick` → `e.stopPropagation()` — **stops click bubbling only**, not pointer events |
| **Pan system** | `handleScenePointerDown` returns early if `closest('[data-tree-click="true"]')` — **does not** set `panStartRef` when the tree is the target **and** `closest` works |

### Inspector panel + close

| Field | Detail |
|--------|---------|
| **File** | Wrapper: `web/src/app/vector-forest/page.tsx`; panel: `web/src/components/vector-forest/TreeInspectorPanel.tsx` |
| **DOM** | Outer **`div`** with `data-ui-overlay="true"`; inner close control is **`<button onClick={onClose}>`** **without** its own `data-ui-overlay` |
| **Position / layer** | `absolute right-0 top-0 ... z-10`, sibling of forest `containerRef` (also `z-10`) and bottom bar |
| **z-index vs chrome** | Inspector uses **`z-10`**. Scenario / Reset / Fullscreen use **`z-[250]`** — **much higher** |
| **Events** | Close is **`onClick` only**; no pointer-level guards |
| **Pan system** | Inspector is **not** a descendant of the scene root — **scene pointer handlers do not attach here** |

### Year slider (bottom bar)

| Field | Detail |
|--------|---------|
| **File** | `web/src/app/vector-forest/page.tsx` |
| **DOM** | Native `<input type="range">` inside `data-ui-overlay` strip |
| **Layer** | Outside `VectorForestScene`; **not** under scene root pointer handlers |

### Top navigation (Dashboard, Forest Modification, Generalize Area, etc.)

| Field | Detail |
|--------|---------|
| **File** | `web/src/components/layout/AppShell.tsx` |
| **DOM** | Next.js **`<Link>`** (renders as `<a href="...">`) inside `<nav>`; mobile menu uses the same `Link` list inside a conditional panel |
| **`data-ui-overlay`** | **No** — header links are **not** part of the Vector Forest overlay contract |
| **Position / layer** | **`<header>`** uses **`sticky top-0 z-50 relative`**. Main content (including Vector Forest) is **`<main className="... relative z-10">`** — **below** the header in CSS stacking (`50` vs `10`) |
| **Pointer-events** | No `pointer-events` override on the header or links. Decorative **`.cloud`** elements and **`body::before` / `body::after`** use **`pointer-events: none`** in `globals.css`, so they should **not** steal clicks |
| **Events** | **Client-side navigation** via Next.js `Link` (depends on **click** / **pointer** reaching the anchor) |
| **Pan system** | **None** — header is **not** under `VectorForestScene`; **no** `onPointerDown` / `setPointerCapture` on these elements |
| **Stop propagation** | Links do **not** call `stopPropagation`; global `a:active { transform: scale(0.98) }` in `globals.css` is cosmetic only |

**Structural takeaway:** In pure **layout / z-index** terms, the sticky header should **remain above** the page content and **reachable** for hit-testing. There is **no** obvious “forest card covers the navbar” stacking bug in the static CSS — unlike trees (inside a transformed pan layer) or the inspector (`z-10` vs in-card `z-[250]`).

---

## 3) Most likely root cause (from the contrast)

The observation — **Scenario, Reset View, and Fullscreen keep working while trees / inspector (and sometimes top nav) feel broken** — must be split into **local** vs **possibly global** failure modes:

### 3a) Strong local pattern (forest-only)

**Scenario, Reset View, and Fullscreen keep working while trees / inspector feel broken** still lines up with **three structural facts** for everything **inside or beside the forest card**:

### A. Two different UI strata by **z-index and DOM placement**

- **Overlay chrome (Scenario, Reset, Fullscreen):** **`z-[250]`**, deliberately **above** the forest pan layer and all trees.
- **Inspector:** **`z-10`**, **same nominal band as** `containerRef` (`z-10`), **below** all `z-[250]` controls.
- **Trees:** Inside the **transformed** pan stack, **z ≤ 200**.

So anything that still “wins” hit-testing at **forest coordinates** at **`z-250`** (Scenario pill, Reset) keeps working. Anything that depends on **trees** (lower stack, transformed layer) or on a **panel at `z-10`** is **much easier to mask or reorder** if stacking / hit-testing gets into a bad state after pointer/slider interaction.

That matches “**in-forest** overlay buttons still work, **trees** do not” **without** requiring a full-screen invisible div over the whole app.

### 3b) Top nav failures — how they differ from the in-forest pattern

If **Dashboard / Forest Modification / Generalize Area / …** truly stop responding **after the same slider interaction**, that **cannot** be explained by **low z-index inside the forest card** or **`data-tree-click` vs `data-ui-overlay`** alone — the nav is **`z-50`**, outside `VectorForestScene`, and uses ordinary **`<a>`** links.

**Plausible unified mechanisms for nav + forest both breaking:**

1. **Stuck or lingering `pointer` state (e.g. pointer capture)**  
   If an element (commonly the **scene root** in `VectorForestScene`) holds **`setPointerCapture(pointerId)`** and that capture is **not released** as expected after a **slider drag**, the browser may **retarget subsequent pointer events** for that pointer to the capturing element instead of the real hit target under the cursor. That can make **clicks on the header** appear to do nothing **even though** the header is visually on top.  
   **Tension:** Under strict capture semantics, **in-scene** controls that are **descendants** of the same capture target might also fail — yet **Scenario / Reset** (children of the scene root) are reported as **still working**. Possible resolutions: capture is **not** stuck in those sessions; **“works”** was observed with a different gesture order; or **some** controls still receive **synthetic click** behavior inconsistently across browsers.

2. **Document / fullscreen / focus edge cases**  
   Vector Forest uses **`requestFullscreen()`** on the **card**. While **fullscreen** is active, **browser UI and page chrome** behave differently; after exit, a **rare** focus or input routing issue could theoretically affect **clicks** until the next user action. Worth noting in repro steps whether fullscreen was toggled.

3. **Automation vs real browser**  
   Prior checks found **Next.js `Link` + Playwright** could **fail to navigate** even when the DOM looked correct. Real-user **navbar** failures should be confirmed with **`document.elementFromPoint`** on a **nav link** after repro to see whether the **`<a>`** is still topmost.

**Practical diagnostic (when allowed):** After the bug fires, run **`elementsFromPoint(x, y)`** at the center of a **nav label** and compare to a **Scenario** button. If the stack shows **`role="presentation"`** (scene root) or another forest node **above** the `<a>`, suspect **capture / retargeting** or an unexpected overlay. If the stack shows the **`<a>`** on top but navigation still fails, suspect **router / Link / JS error** rather than geometry.

### B. Trees are inside the **pan / pointer-capture surface**; overlay buttons are not

Pan logic lives on the **scene root** (`onPointerDown/Move/Up`, deferred `setPointerCapture` on that element). Trees sit **inside** the child that is **`absolute inset-0` + `transform`**. Scenario and Reset are **siblings** of that layer with **higher z-index**, so they are **not** inside the translated subtree.

So tree interaction is **coupled** to:

- pointer flow on the scene root,
- possible **pointer capture** on the scene root,
- and **`panStartRef` / `isPanningRef` / `pointerup` → deselect** (`onSelectionChange(null)` when `panStartRef` was set and `!wasPanning`).

Working overlay buttons **bypass** starting a pan from their targets (overlay check) and sit **above** the pan layer visually and for hit-testing order.

### C. Event shape: trees use **click + `stopPropagation` on click only**

Tree buttons **stop propagation on `click`**, not on **`pointerup`**. A `pointerup` from a tree can still **bubble** to the scene root. If `panStartRef` is **incorrectly non-null** after a messy slider/pointer sequence, **`handleScenePointerUp`** can run **deselect** logic in addition to whatever the tree `click` does — ordering and capture quirks can produce **flaky open/close or missed clicks**. Scenario/Reset **don’t** depend on that same “click tree vs background pointerup” interplay.

**Inspector close** is weaker on stacking: **`z-10` vs `z-[250]`** means any overlap from high-z controls (e.g. fullscreen control vs right strip of the panel) or **painting order edge cases** hurts the **low-z** panel more than the **250** controls. Inspector is also **not** protected by `data-ui-overlay` on the **close button itself** (only the wrapper), which matters only if some logic keyed off `closest('[data-ui-overlay]')` on the **event target** — the close button’s target would **not** match the inner button, but would match the **wrapper** via `closest` **if** the event path is normal.

---

## 4) Which labeled hypothesis fits best

| # | Hypothesis | Fit |
|---|------------|-----|
| **1** | Failing layer blocked, working layer not | **Partially** — trees are in a **different (transformed, lower-z)** layer than **`z-250`** controls. |
| **2** | Working = “protected” overlay; failing = pannable scene | **Strong** — matches DOM, z-index, and pan handler `closest` behavior. |
| **3** | Pointer canceled/suppressed after slider | **Plausible** for **trees and scene-root pointer capture**; **less** plausible for **fullscreen** (outside scene); **inspector** would need **overlap / stacking** or **global** capture (rare) to match. |
| **4** | Transparent overlay only over forest | **Plausible** if interpreted as **scene-root pointer capture + pan layer** affecting **tree** targets only, not **z-250** siblings. |
| **5** | Stuck deselect / selection vs standalone buttons | **Plausible** — **`handleScenePointerUp`** can call **`onSelectionChange(null)`** when **`panStartRef`** was set and **`!wasPanning`**; trees **`stopPropagation` on click only**, not **`pointerup`**. Overlay buttons don’t rely on that path for their primary action. |
| **6** | **Global pointer capture / retargeting** breaks **top nav** | **Plausible** if **`setPointerCapture`** remains active on the **scene root**: events for that pointer may **not** reach **`z-50`** header links. **Reconcile** with “Scenario still works” (same subtree as capture target) via session ordering, browser variance, or confirm with **`elementsFromPoint`**. |

**Best single narrative (forest + inspector):**  
**Trees (and to a lesser extent low-z inspector) sit in a different compositing/interaction stratum than `data-ui-overlay` + `z-[250]` controls. After slider use, pointer/capture/`panStartRef` / `pointerup` deselect behavior stays biased toward the scene root and the transformed pan subtree, while high-z overlay chrome keeps working.**

**Addendum for top nav:**  
**Sticky header links are structurally unrelated to forest z-layers; if they fail too, prioritize verifying stuck or mis-ordered pointer capture / `elementsFromPoint` rather than inspector-style z-10 overlap.**

---

## 5) Side-by-side: why some survive and others don’t

| Control | Under scene root? | In transformed pan `div`? | `data-ui-overlay`? | Typical z | Pan `pointerdown` starts here? | Primary event |
|---------|-------------------|---------------------------|--------------------|-----------|--------------------------------|---------------|
| Scenario | Yes | No | Yes | 250 | No (skipped) | `onClick` |
| Reset | Yes | No | Yes | 250 | No (skipped) | `onClick` |
| Fullscreen | **No** | No | Yes | 250 | N/A (no scene handlers) | `onClick` |
| Tree | Yes | **Yes** | No (`data-tree-click`) | ≤200 | No (skipped if `closest` works) | **`onClick` + bubbled `pointerup`** to scene |
| Inspector close | No | No | Wrapper only | **10** | N/A | `onClick` |
| **Header nav `Link`** | **No** | **No** | **No** | **50** (header) | **N/A** | **Next `Link` / navigation** |

**Survivors:** **high z**, **outside pan transform**, **explicit overlay exemption** from pan start, and/or **outside** the scene component.  
**Victims:** **inside pan layer** and/or **low z** and **tied to selection + pointerup/deselect** semantics.  
**Top nav** is a **special case**: **static** CSS says it should sit **above** main (`z-50` vs `z-10`); if it still fails, suspect **pointer capture / global pointer routing** or **tooling**, not the same **in-card** z-index story as the inspector.

---

## 6) Single most promising fix *direction* (not implemented in this document)

1. **Unify “UI chrome” stacking** so inspector (and any modal panel) is **not** stuck at **`z-10`** while in-scene controls use **`z-[250]`**, **or** document and test overlap of **`z-[250]`** fullscreen vs **`z-10`** inspector.
2. **Reconcile pointer vs click for trees:** ensure **`pointerup`** / **`panStartRef`** / **deselect** cannot run in a way that **races or negates** tree **`click`** after slider-driven pointer capture (e.g. **`stopPropagation` on pointerup** from tree, or **stricter** `panStartRef` lifecycle).
3. **Optional diagnosis** (when instrumentation is allowed): log **`handleScenePointerUp`** with **`e.target`**, **`panStartRef`**, **`wasPanning`**, and after repro run **`document.elementFromPoint`** / **`document.elementsFromPoint`** at (**a**) a **tree**, (**b**) **Scenario**, and (**c**) a **header nav link** — to confirm **capture / retargeting** vs **local z-order** vs **deselect**. Optionally test **`sceneRoot.hasPointerCapture(pointerId)`** for the active mouse pointer id.

---

*This document is analysis-only; it does not implement fixes.*
