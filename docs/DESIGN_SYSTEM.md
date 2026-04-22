# CO₂ Pomfret — Design System

> Reference for all visual tokens and component patterns.  
> **Do not set border-radius, colours, or font sizes ad-hoc.** Use the tokens below.

---

## Principles

| Principle | Meaning for this project |
|-----------|--------------------------|
| Educational, not corporate | Warm, readable typography; explanation text under every chart |
| Light mode only | No dark-mode variants needed; the cloud background keeps it airy |
| Forest-inspired palette | Teal + emerald primary; amber for warnings; violet for CO₂e |
| Approachable complexity | Dense data is fine — layout, spacing, and labels carry the weight |
| Graph section as canonical reference | The `/visualizations` page is the design benchmark |

---

## 1 — Border Radius Hierarchy

Defined in `globals.css :root` and wired into `tailwind.config.ts`.

| Token | CSS variable | Value | Tailwind class | Use |
|-------|-------------|-------|----------------|-----|
| Panel | `--radius-panel` | 20 px | `rounded-panel` | Page-level containers, hero sections, canvas frames |
| Card | `--radius-card` | 12 px | `rounded-card` | **Standard card** — shadcn `<Card>`, metric tiles, info panels |
| Control | `--radius-control` | 6 px | `rounded-control` | Buttons, inputs, selects, pill-selector trays |
| Pill | `--radius-pill` | 4 px | `rounded-pill` | Small badges, tag chips, active pill inside a tray |

**Rule:** Never mix levels within the same element. A button that sits inside a card still uses `rounded-control`, not `rounded-card`.

---

## 2 — Spacing Scale

Tailwind's 4 px base grid is the source of truth. Only reach for the `--space-*` tokens when Tailwind's `p-*`/`gap-*` utilities aren't available (e.g. CSS-only contexts).

| Token | px | Use |
|-------|----|-----|
| `--space-xs` | 4 | Tight icon gaps, inline badge padding |
| `--space-sm` | 8 | Internal control padding (pill buttons) |
| `--space-md` | 12 | Gap between cards in a row (`gap-3`) |
| `--space-lg` | 16 | Compact card padding |
| `--space-xl` | 24 | **Standard card padding** (`p-6`), section gaps (`gap-6`) |
| `--space-2xl` | 32 | Between major sections (`space-y-8`) |
| `--space-3xl` | 48 | Page-level vertical rhythm (`py-12`) |

**Recommended page structure:**
```
<div class="space-y-6">   ← between card rows
  <div class="grid grid-cols-2 gap-3">  ← metric card grid
  <div class="grid grid-cols-2 gap-4">  ← chart card grid
```

---

## 3 — Typography Scale

All tokens are defined in `globals.css :root` and exposed as Tailwind `text-*` utilities via `tailwind.config.ts`.

| Role | Token | Size | Weight | Colour | Tailwind / CSS class |
|------|-------|------|--------|--------|----------------------|
| Page title | `--font-size-page` | 24 px | 700 | `--text` | `text-page-title` |
| Section title | `--font-size-section` | 16 px | 600 | `--text` | `text-section-title` |
| Card title | `--font-size-card` | 13 px | 600 | slate-700 | `text-card-title` |
| Body | `--font-size-body` | 14 px | 400 | `--text-body` | `text-body` (default) |
| Secondary / meta | `--font-size-meta` | 12 px | 400 | `--text-muted` | `text-meta` |
| Label / micro | `--font-size-label` | 11 px | 500 | `--text-muted` | `text-label` |

**Pattern:** Every card follows `card-title → meta description → content`. Never put a page-title-size heading inside a card.

---

## 4 — Colour System

### Background & Surface
| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#eef3f7` | Page background (cool blue-white) |
| `--surface` | `#ffffff` | Card / panel fill |
| `--surface-2` | `#f1f5f9` | Pill-selector trays, code blocks, recessed areas |

### Text
| Token | Approx Tailwind | Use |
|-------|-----------------|-----|
| `--text` | slate-800 | Headings, metric values |
| `--text-body` | slate-700 | Paragraph / body copy |
| `--text-muted` | slate-500 | Captions, secondary labels |
| `--text-faint` | slate-400 | Placeholders, disabled |

### Primary — Forest Teal
| Token | Hex | Tailwind equiv |
|-------|-----|----------------|
| `--primary` | `#0d9488` | teal-600 |
| `--primary-hover` | `#0f766e` | teal-700 |
| `--primary-light` | `#ccfbf1` | teal-100 |
| `--primary-glow` | rgba teal | Shadow tint for primary buttons |

### Chart Palette (7 fixed colours)
Use these in Recharts `stroke=` / `fill=` props and **do not** deviate.

| Token | Hex | Semantic meaning |
|-------|-----|-----------------|
| `--chart-1` | `#0d9488` | Primary / All Trees |
| `--chart-2` | `#059669` | Lower plot / growth |
| `--chart-3` | `#2563eb` | Middle plot / structural |
| `--chart-4` | `#7c3aed` | Upper plot / CO₂e |
| `--chart-5` | `#d97706` | Warning / disturbance |
| `--chart-6` | `#db2777` | Species accent |
| `--chart-7` | `#0891b2` | Secondary structural |

### Ecological State Colours
Used in vector forest tree rendering and scenario overlays.

| Token | Hex | State |
|-------|-----|-------|
| `--eco-healthy` | `#16a34a` | Normal growth |
| `--eco-stressed` | `#ca8a04` | Drought / competition |
| `--eco-disturbed` | `#dc2626` | Fire / flood damage |
| `--eco-recovering` | `#0284c7` | Post-disturbance recovery |

---

## 5 — Component Patterns

### Page Container
Every page rendered inside `AppShell` should use:
```jsx
<div className="space-y-6">
  {/* page content */}
</div>
```
Do not add extra horizontal padding — `AppShell` handles the viewport margins.

### Cards
Use the `<Card>` shadcn component for new code. Use the `.card` global class for pages not yet migrated (Dashboard, About, Scenarios).

```jsx
// ✅ New pattern (graph page standard)
<Card>
  <CardHeader className="pb-1">
    <CardTitle className="text-card-title">Chart Title</CardTitle>
    <CardDescription className="text-meta">One-line explanation.</CardDescription>
  </CardHeader>
  <CardContent className="pt-2">
    {/* chart or content */}
  </CardContent>
</Card>

// ✅ Legacy global class (Dashboard / About until redesigned)
<div className="card">
  <h2 className="text-section-title mb-4">Section</h2>
  …
</div>
```

### Buttons
```jsx
// Primary action
<Button>Run Simulation</Button>

// Secondary / cancel
<Button variant="outline">Reset</Button>

// Ghost (toolbar icons)
<Button variant="ghost" size="icon"><SomeIcon /></Button>

// Legacy class pages
<button className="btn btn-primary">Run</button>
<button className="btn btn-secondary">Reset</button>
```

### Tabs (AppShell navigation style)
The `<TabsList>` tray uses `rounded-control`; each `<TabsTrigger>` uses `rounded-pill`. This matches the pill-selector in `GraphSectionControls`.

```jsx
<Tabs>
  <TabsList>
    <TabsTrigger value="a">Tab A</TabsTrigger>
    <TabsTrigger value="b">Tab B</TabsTrigger>
  </TabsList>
  <TabsContent value="a">…</TabsContent>
</Tabs>
```

### Selects
```jsx
<Select>
  <SelectTrigger className="h-8 w-[160px] text-sm">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Plots</SelectItem>
    …
  </SelectContent>
</Select>
```
Height: `h-8` for compact controls inside toolbars; `h-9` (default) for form contexts.

### Sliders
```jsx
<Slider
  min={0}
  max={20}
  step={1}
  value={[year]}
  onValueChange={([v]) => setYear(v)}
  className="w-full"
/>
```
Track: `bg-surface-2` with primary fill. Thumb: white with a 2 px teal border.

### Pill Year Selector (inline control pattern)
Copy the `GraphSectionControls` pattern for any multi-option picker with ≤5 choices:
```jsx
<div className="flex rounded-control bg-[var(--surface-2)] p-0.5 gap-0.5">
  {OPTIONS.map(opt => (
    <button
      key={opt}
      onClick={() => setOpt(opt)}
      className={`px-3.5 py-1.5 rounded-pill text-sm font-medium transition-all duration-150
        ${active === opt
          ? 'bg-white text-slate-800 shadow-sm'
          : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
        }`}
    >
      {opt}
    </button>
  ))}
</div>
```

### Section Headers
Use the existing `<SectionHeader>` component (`web/src/components/ui/SectionHeader.tsx`).  
Its `text-heading-2` and `text-label` classes are now properly defined in `globals.css`.

```jsx
<SectionHeader
  title="Forest Analysis"
  subtitle="Exploring carbon trends across three plots"
/>
```

### Metric Cards
Follow the `GraphMetricCards` pattern exactly:
```jsx
<div className="rounded-card border border-slate-200/80 bg-white p-4 shadow-sm">
  <div className="flex items-center justify-between mb-2">
    <span className="text-label text-[var(--text-muted)]">Total Carbon</span>
    <div className="rounded-control p-1.5" style={{ backgroundColor: '#0d948818' }}>
      <Leaf className="w-3.5 h-3.5 text-[var(--primary)]" />
    </div>
  </div>
  <span className="text-xl font-bold text-[var(--text)]">98.8k</span>
  <span className="ml-1.5 text-meta text-[var(--text-faint)]">kg C</span>
</div>
```

---

## 6 — Pages / Components That Need Adopting

When redesigning individual pages, migrate them to this system in this priority order:

| Priority | File | What to change |
|----------|------|----------------|
| 1 | `app/page.tsx` (Dashboard) | Replace `.card`/`.btn` with `<Card>` / `<Button>`; `text-2xl font-semibold` → `text-page-title`; hardcoded year buttons → pill selector |
| 2 | `app/about/page.tsx` | Same `.card` → `<Card>` pass; page heading; `text-[var(--primary)]` bullets → consistent |
| 3 | `app/scenarios/page.tsx` | Largest migration; raw `select`/`input` HTML → shadcn components; section headings |
| 4 | `app/vector-forest/page.tsx` | Panel radius upgrade to `rounded-panel`; controls to shadcn |
| 5 | `components/layout/AppShell.tsx` | Already close; minor token alignment |
| ✅ Done | `app/visualizations/page.tsx` | Already uses `<Card>` + correct pattern — this is the reference |

---

## 7 — What NOT to Do

- Do not use raw Tailwind `rounded-xl`, `rounded-2xl`, `rounded-3xl` for structural elements — use the named tokens instead so radius can be changed globally.
- Do not hardcode hex values for chart colours in component markup. Import them from `visualizationData.ts` or reference `var(--chart-N)`.
- Do not use `text-slate-700` etc. for structural text roles — use `var(--text)`, `var(--text-body)`, `var(--text-muted)` so the palette can shift without grep-and-replace.
- Do not create a new shadow style. Use `shadow-sm` (standard card) or `shadow` (elevated popover). Nothing heavier unless it's a floating modal.
