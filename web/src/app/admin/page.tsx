'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  GitBranch,
  History,
  Loader2,
  Send,
  Shield,
  Upload,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AdminApiError,
  AdminPublishOverrides,
  checkAdminHealth,
  getCurrentRevision,
  getLatestPreview,
  getRevisions,
  previewSheetSync,
  publishSheetSync,
} from '@/lib/adminApi'
import { notifyPublishSucceeded } from '@/lib/usePublishSync'

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'co2-admin-ui-v1'
const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

type FormState = {
  apiBase: string
  adminToken: string
  spreadsheetId: string
  tabLower: string
  tabMiddle: string
  tabUpper: string
  includeNnEpsilon: boolean
}

const DEFAULT_FORM: FormState = {
  apiBase: DEFAULT_API_BASE,
  adminToken: '',
  spreadsheetId: '',
  tabLower: 'Lower',
  tabMiddle: 'Middle',
  tabUpper: 'Upper',
  includeNnEpsilon: false,
}

function loadInitialForm(): FormState {
  if (typeof window === 'undefined') return DEFAULT_FORM
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_FORM
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_FORM, ...parsed }
  } catch {
    return DEFAULT_FORM
  }
}

type PanelKey =
  | 'health'
  | 'preview'
  | 'latestPreview'
  | 'publish'
  | 'currentRevision'
  | 'revisions'

type PanelStatus = 'idle' | 'loading' | 'ok' | 'error'

type PanelState = {
  status: PanelStatus
  data?: unknown
  error?: string
  errorDetail?: unknown
  ranAt?: number
}

const INITIAL_PANEL: PanelState = { status: 'idle' }

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [hydrated, setHydrated] = useState(false)
  const [confirmingPublish, setConfirmingPublish] = useState(false)
  const [authDisabledBanner, setAuthDisabledBanner] = useState<{
    show: boolean
    warning?: string
  }>({ show: false })
  const [panels, setPanels] = useState<Record<PanelKey, PanelState>>({
    health: INITIAL_PANEL,
    preview: INITIAL_PANEL,
    latestPreview: INITIAL_PANEL,
    publish: INITIAL_PANEL,
    currentRevision: INITIAL_PANEL,
    revisions: INITIAL_PANEL,
  })

  useEffect(() => {
    setForm(loadInitialForm())
    setHydrated(true)
  }, [])

  useEffect(() => {
    const h = panels.health
    if (h.status !== 'ok' || !h.data || typeof h.data !== 'object') {
      return
    }
    const d = h.data as Record<string, unknown>
    if (d.admin_auth_disabled === true) {
      setAuthDisabledBanner({
        show: true,
        warning: typeof d.warning === 'string' ? d.warning : undefined,
      })
    } else {
      setAuthDisabledBanner({ show: false })
    }
  }, [panels.health])

  useEffect(() => {
    if (!hydrated) return
    try {
      const { adminToken, ...rest } = form
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...rest, adminToken }))
    } catch {
      // ignore quota / private mode errors
    }
  }, [form, hydrated])

  const update = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  )

  const setPanel = useCallback(
    (key: PanelKey, next: PanelState) =>
      setPanels((prev) => ({ ...prev, [key]: next })),
    [],
  )

  const buildOverrides = useCallback(
    (extra: Partial<AdminPublishOverrides> = {}): AdminPublishOverrides => ({
      spreadsheet_id: form.spreadsheetId,
      tabs: {
        Lower: form.tabLower,
        Middle: form.tabMiddle,
        Upper: form.tabUpper,
      },
      ...extra,
    }),
    [form],
  )

  const run = useCallback(
    async (key: PanelKey, fn: () => Promise<unknown>) => {
      setPanel(key, { status: 'loading' })
      try {
        const data = await fn()
        setPanel(key, { status: 'ok', data, ranAt: Date.now() })
      } catch (e) {
        const err = e as AdminApiError | Error
        setPanel(key, {
          status: 'error',
          error: err.message,
          errorDetail: 'detail' in err ? (err as AdminApiError).detail : undefined,
          ranAt: Date.now(),
        })
      }
    },
    [setPanel],
  )

  const ready = Boolean(form.apiBase.trim())

  const tokenForRequest = form.adminToken.trim() || undefined

  const onCheckHealth = () =>
    run('health', () => checkAdminHealth(form.apiBase, tokenForRequest))

  const onPreview = () =>
    run('preview', () =>
      previewSheetSync(form.apiBase, tokenForRequest, buildOverrides()),
    )

  const onLatestPreview = () =>
    run('latestPreview', () => getLatestPreview(form.apiBase, tokenForRequest))

  const onPublishConfirmed = async () => {
    setConfirmingPublish(false)
    setPanel('publish', { status: 'loading' })
    try {
      const data = await publishSheetSync(
        form.apiBase,
        tokenForRequest,
        buildOverrides({ include_nn_epsilon: form.includeNnEpsilon }),
      )
      setPanel('publish', { status: 'ok', data, ranAt: Date.now() })
      // Tell any open dashboard tab to refetch immediately. The hook also
      // polls /dataset-version on a 15s interval so this is just a latency
      // optimisation when the user has both pages open.
      const payload = data as Record<string, unknown> | undefined
      if (payload && payload.status === 'published') {
        notifyPublishSucceeded({
          revision_id:
            typeof payload.revision_id === 'string'
              ? payload.revision_id
              : null,
          published_at:
            typeof payload.published_at === 'string'
              ? payload.published_at
              : null,
        })
      }
    } catch (e) {
      const err = e as AdminApiError | Error
      setPanel('publish', {
        status: 'error',
        error: err.message,
        errorDetail:
          'detail' in err ? (err as AdminApiError).detail : undefined,
        ranAt: Date.now(),
      })
    }
  }

  const onCurrentRevision = () =>
    run('currentRevision', () => getCurrentRevision(form.apiBase, tokenForRequest))

  const onRevisions = () =>
    run('revisions', () => getRevisions(form.apiBase, tokenForRequest))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-faint)]">
          Data station · restricted
        </p>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--primary)_40%,var(--border))] bg-[var(--primary-light)]">
            <Shield className="h-4 w-4 text-[var(--primary)]" strokeWidth={1.5} />
          </span>
          <h1 className="text-page-title">Admin / Sheet Sync</h1>
        </div>
        <p className="text-[var(--text-muted)] max-w-2xl leading-relaxed">
          Local-only tool for previewing and publishing Google Sheets data
          through the FastAPI admin routes. Leave the token blank if the
          backend is running with{' '}
          <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 text-xs">
            CO2_DISABLE_ADMIN_AUTH=true
          </code>{' '}
          (development only). Service-account credentials never leave the server.
        </p>
      </div>

      {authDisabledBanner.show && (
        <div
          role="status"
          className="rounded-card border border-[color-mix(in_srgb,var(--warning)_55%,var(--border))] border-l-[3px] border-l-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_10%,var(--surface))] px-4 py-3 text-sm text-[var(--text)]"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" strokeWidth={1.5} />
            <div>
              <div className="font-display font-semibold text-[var(--text)]">Admin auth is disabled on this backend</div>
              <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                {authDisabledBanner.warning ||
                  'Use only for local development. Never expose this setting on a public deployment.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Connection card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">Connection</CardTitle>
          <CardDescription>
            Backend base URL. The admin token matches{' '}
            <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs">
              CO2_ADMIN_TOKEN
            </code>{' '}
            unless you disabled admin auth for local testing — then leave it
            blank.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="API base URL"
            value={form.apiBase}
            onChange={(v) => update('apiBase', v)}
            placeholder="http://127.0.0.1:8000"
          />
          <Field
            label="Admin token (optional if auth disabled)"
            value={form.adminToken}
            onChange={(v) => update('adminToken', v)}
            type="password"
            placeholder="Leave blank when CO2_DISABLE_ADMIN_AUTH=true"
          />
        </CardContent>
      </Card>

      {/* Sheet config card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">Spreadsheet</CardTitle>
          <CardDescription>
            Overrides the backend&apos;s{' '}
            <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs">
              CO2_SHEETS_*
            </code>{' '}
            env vars per request. Leave blank to fall back to whatever is set
            on the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Spreadsheet ID"
            value={form.spreadsheetId}
            onChange={(v) => update('spreadsheetId', v)}
            placeholder="e.g. 1AbCdEfG..."
          />
          <div className="grid grid-cols-3 gap-3 sm:col-span-1">
            <Field
              label="Lower tab"
              value={form.tabLower}
              onChange={(v) => update('tabLower', v)}
              placeholder="Lower"
            />
            <Field
              label="Middle tab"
              value={form.tabMiddle}
              onChange={(v) => update('tabMiddle', v)}
              placeholder="Middle"
            />
            <Field
              label="Upper tab"
              value={form.tabUpper}
              onChange={(v) => update('tabUpper', v)}
              placeholder="Upper"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">Actions</CardTitle>
          <CardDescription>
            Each button hits one admin route. Results render below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={onCheckHealth}
            disabled={!ready || panels.health.status === 'loading'}
          >
            {panels.health.status === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            Check admin health
          </Button>

          <Button
            variant="primary"
            onClick={onPreview}
            disabled={!ready || panels.preview.status === 'loading'}
          >
            {panels.preview.status === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Preview sheet changes
          </Button>

          <Button
            variant="outline"
            onClick={onLatestPreview}
            disabled={!ready || panels.latestPreview.status === 'loading'}
          >
            {panels.latestPreview.status === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Load latest preview
          </Button>

          <Button
            variant="outline"
            onClick={onCurrentRevision}
            disabled={!ready || panels.currentRevision.status === 'loading'}
          >
            {panels.currentRevision.status === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitBranch className="h-4 w-4" />
            )}
            Load current revision
          </Button>

          <Button
            variant="outline"
            onClick={onRevisions}
            disabled={!ready || panels.revisions.status === 'loading'}
          >
            {panels.revisions.status === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <History className="h-4 w-4" />
            )}
            Load revision history
          </Button>

          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] select-none">
              <input
                type="checkbox"
                checked={form.includeNnEpsilon}
                onChange={(e) => update('includeNnEpsilon', e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
              Include NN epsilon
            </label>
            <Button
              variant="default"
              onClick={() => setConfirmingPublish(true)}
              disabled={!ready || panels.publish.status === 'loading'}
            >
              {panels.publish.status === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Publish sheet changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation banner */}
      {confirmingPublish && (
        <ConfirmPublishBanner
          form={form}
          onCancel={() => setConfirmingPublish(false)}
          onConfirm={onPublishConfirmed}
        />
      )}

      {/* Results — render in a fixed order */}
      <PanelHealth state={panels.health} />
      <PanelPreview title="Preview" state={panels.preview} />
      <PanelPreview title="Latest preview (cached)" state={panels.latestPreview} />
      <PanelPublish state={panels.publish} />
      <PanelCurrentRevision state={panels.currentRevision} />
      <PanelRevisions state={panels.revisions} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confirmation banner
// ---------------------------------------------------------------------------

function ConfirmPublishBanner({
  form,
  onCancel,
  onConfirm,
}: {
  form: FormState
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Card className="border-[var(--accent)]/40 bg-[var(--accent-light)]/30">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--accent-text)]" />
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">
              Publish will overwrite the live dataset.
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              Re-reads the spreadsheet, regenerates baseline + stochastic
              snapshots, and atomically swaps canonical CSVs. The previous
              revision stays in <code>Data/Revisions/</code> for rollback.
              {form.includeNnEpsilon
                ? ' NN epsilon snapshots will also be regenerated (slower).'
                : ''}
            </div>
          </div>
        </div>
        <div className="flex gap-2 sm:shrink-0">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={onConfirm}>
            Yes, publish
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Field helper
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Result panels
// ---------------------------------------------------------------------------

function PanelShell({
  title,
  state,
  children,
}: {
  title: string
  state: PanelState
  children?: React.ReactNode
}) {
  if (state.status === 'idle') return null
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-card-title flex items-center gap-2">
            {state.status === 'loading' && (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />
            )}
            {state.status === 'ok' && (
              <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
            )}
            {state.status === 'error' && (
              <AlertTriangle className="h-4 w-4 text-[var(--error)]" />
            )}
            {title}
          </CardTitle>
          {state.ranAt && (
            <span className="text-xs text-[var(--text-faint)]">
              {new Date(state.ranAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.status === 'error' ? (
          <ErrorBlock message={state.error} detail={state.errorDetail} />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

function ErrorBlock({ message, detail }: { message?: string; detail?: unknown }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-[var(--error)]">
        {message || 'Request failed.'}
      </div>
      {detail !== undefined && (
        <JsonBlock value={detail} muted />
      )}
    </div>
  )
}

function JsonBlock({ value, muted }: { value: unknown; muted?: boolean }) {
  return (
    <pre
      className={`max-h-80 overflow-auto rounded-card border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs leading-relaxed ${
        muted ? 'text-[var(--text-muted)]' : 'text-[var(--text)]'
      }`}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

// --- Health ---------------------------------------------------------------

function PanelHealth({ state }: { state: PanelState }) {
  return (
    <PanelShell title="Admin health" state={state}>
      {state.status === 'ok' && <JsonBlock value={state.data} />}
    </PanelShell>
  )
}

// --- Preview / latest-preview --------------------------------------------

type DiffShape = {
  overall?: {
    headline?: string
    changed_plots?: string[]
    totals?: Record<string, number>
  }
  per_plot?: Record<
    string,
    {
      summary?: Record<string, number>
      added_trees?: Array<Record<string, unknown>>
      removed_trees?: Array<Record<string, unknown>>
      species_changes?: Array<Record<string, unknown>>
      dbh_cell_changes?: Array<Record<string, unknown>>
      new_year_columns?: number[]
      removed_year_columns?: number[]
    }
  >
  notes?: string[]
}

type ValidationShape = {
  is_valid?: boolean
  summary?: { errors?: number; warnings?: number; plots?: number }
  findings?: Array<{ code?: string; severity?: string; message?: string }>
  per_plot?: Record<
    string,
    {
      findings?: Array<{ code?: string; severity?: string; message?: string }>
      rows?: number
      dbh_year_columns?: Record<string, string>
      is_valid?: boolean
    }
  >
}

type PreviewPayload = {
  revision_id?: string
  validation?: ValidationShape
  diff?: DiffShape
  warnings?: Array<{ plot?: string | null; code?: string; severity?: string; message?: string }>
}

function PanelPreview({ title, state }: { title: string; state: PanelState }) {
  return (
    <PanelShell title={title} state={state}>
      {state.status === 'ok' && (
        <PreviewBody payload={state.data as PreviewPayload} />
      )}
    </PanelShell>
  )
}

function PreviewBody({ payload }: { payload: PreviewPayload }) {
  const diff = payload.diff
  const validation = payload.validation
  const overall = diff?.overall
  const errorCount = validation?.summary?.errors ?? 0
  const warningCount = validation?.summary?.warnings ?? 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {payload.revision_id && (
          <Badge tone="default">revision {payload.revision_id}</Badge>
        )}
        <Badge tone={validation?.is_valid ? 'ok' : 'error'}>
          {validation?.is_valid ? 'valid' : 'invalid'}
        </Badge>
        <Badge tone={errorCount > 0 ? 'error' : 'muted'}>
          {errorCount} error{errorCount === 1 ? '' : 's'}
        </Badge>
        <Badge tone={warningCount > 0 ? 'warn' : 'muted'}>
          {warningCount} warning{warningCount === 1 ? '' : 's'}
        </Badge>
      </div>

      {overall && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-[var(--text)]">
            {overall.headline || 'Diff summary'}
          </div>
          {overall.changed_plots && overall.changed_plots.length > 0 && (
            <div className="text-xs text-[var(--text-muted)]">
              Plots with changes: {overall.changed_plots.join(', ')}
            </div>
          )}
          {overall.totals && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {Object.entries(overall.totals).map(([k, v]) => (
                <Stat key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
              ))}
            </div>
          )}
        </div>
      )}

      <ValidationFindings validation={validation} />

      {diff?.per_plot && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text)]">Per-plot detail</h3>
          {Object.entries(diff.per_plot).map(([plot, d]) => (
            <PerPlotDiff key={plot} plot={plot} data={d} />
          ))}
        </div>
      )}

      <details className="text-xs text-[var(--text-muted)]">
        <summary className="cursor-pointer select-none">Raw response</summary>
        <div className="mt-2">
          <JsonBlock value={payload} muted />
        </div>
      </details>
    </div>
  )
}

function ValidationFindings({ validation }: { validation?: ValidationShape }) {
  if (!validation) return null
  const flat: Array<{ plot?: string; code?: string; severity?: string; message?: string }> = []
  for (const f of validation.findings || []) flat.push(f)
  if (validation.per_plot) {
    for (const [plot, r] of Object.entries(validation.per_plot)) {
      for (const f of r.findings || []) flat.push({ plot, ...f })
    }
  }
  if (flat.length === 0) {
    return (
      <div className="text-xs text-[var(--text-muted)]">No validation findings.</div>
    )
  }
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold text-[var(--text)]">Validation findings</h3>
      <ul className="space-y-1">
        {flat.slice(0, 25).map((f, i) => (
          <li
            key={i}
            className="flex items-start gap-2 rounded-card border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs"
          >
            <SeverityDot severity={f.severity} />
            <div className="flex-1 min-w-0">
              <div className="text-[var(--text)]">
                {f.message || f.code || 'finding'}
              </div>
              <div className="text-[var(--text-faint)]">
                {f.plot ? `${f.plot} · ` : ''}
                {f.code || ''}
              </div>
            </div>
          </li>
        ))}
        {flat.length > 25 && (
          <li className="text-[var(--text-faint)]">
            …and {flat.length - 25} more.
          </li>
        )}
      </ul>
    </div>
  )
}

function PerPlotDiff({
  plot,
  data,
}: {
  plot: string
  data: NonNullable<DiffShape['per_plot']>[string]
}) {
  const s = data.summary || {}
  const empty =
    !Object.values(s).some((v) => Number(v) > 0) &&
    !(data.new_year_columns && data.new_year_columns.length) &&
    !(data.removed_year_columns && data.removed_year_columns.length)
  return (
    <div className="rounded-card border border-[var(--border)] bg-[var(--surface-2)]/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-[var(--text)]">{plot}</div>
        {empty && (
          <span className="text-xs text-[var(--text-faint)]">no changes</span>
        )}
      </div>
      {!empty && (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {Object.entries(s).map(([k, v]) => (
              <Stat key={k} label={k.replace(/_/g, ' ')} value={String(v)} compact />
            ))}
          </div>
          <DiffList title="Added trees" items={data.added_trees} keyFields={['tree_id', 'species']} />
          <DiffList title="Removed trees" items={data.removed_trees} keyFields={['tree_id', 'species']} />
          <DiffList title="Species changes" items={data.species_changes} keyFields={['tree_id', 'from', 'to']} />
          <DiffList title="DBH cell changes" items={data.dbh_cell_changes} keyFields={['tree_id', 'year', 'from', 'to']} limit={10} />
          {data.new_year_columns && data.new_year_columns.length > 0 && (
            <div className="mt-2 text-xs text-[var(--text-muted)]">
              New year columns: {data.new_year_columns.join(', ')}
            </div>
          )}
          {data.removed_year_columns && data.removed_year_columns.length > 0 && (
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              Removed year columns: {data.removed_year_columns.join(', ')}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DiffList({
  title,
  items,
  keyFields,
  limit = 6,
}: {
  title: string
  items?: Array<Record<string, unknown>>
  keyFields: string[]
  limit?: number
}) {
  if (!items || items.length === 0) return null
  return (
    <div className="mt-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {title} ({items.length})
      </div>
      <ul className="mt-1 space-y-0.5">
        {items.slice(0, limit).map((row, i) => (
          <li key={i} className="font-mono text-xs text-[var(--text)]">
            {keyFields
              .map((k) => {
                const v = row[k]
                if (v === undefined || v === null) return null
                return `${k}=${typeof v === 'number' ? v : String(v)}`
              })
              .filter(Boolean)
              .join('  ')}
          </li>
        ))}
        {items.length > limit && (
          <li className="text-xs text-[var(--text-faint)]">
            …and {items.length - limit} more.
          </li>
        )}
      </ul>
    </div>
  )
}

// --- Publish -------------------------------------------------------------

type AddedTreeAudit = {
  plot?: string
  tree_id?: string
  species?: string
  found_in_canonical_raw?: boolean
  found_in_canonical_snapshot_year_0?: boolean
  first_year?: number
  first_year_dbh_in?: number | null
  first_year_dbh_cm?: number | null
  year_0_dbh_cm?: number | null
  year_0_bin_label_cm?: string | null
  plot_total_after_publish?: number | null
}

type PublishPayload = Record<string, unknown> & {
  revision_id?: string
  status?: string
  published_at?: string
  tree_change_summary?: Record<string, unknown>
  promoted_files?: Array<Record<string, string>>
  cache_cleared?: Record<string, unknown> | null
  added_tree_audits?: AddedTreeAudit[]
  validation?: ValidationShape
  diff?: DiffShape
}

function PanelPublish({ state }: { state: PanelState }) {
  return (
    <PanelShell title="Publish result" state={state}>
      {state.status === 'ok' && (
        <PublishBody payload={state.data as PublishPayload} />
      )}
    </PanelShell>
  )
}

function PublishBody({ payload }: { payload: PublishPayload }) {
  const tree = (payload.tree_change_summary || {}) as Record<string, unknown>
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Badge tone={payload.status === 'published' ? 'ok' : 'warn'}>
          status: {String(payload.status || 'unknown')}
        </Badge>
        {payload.revision_id && (
          <Badge tone="default">revision {payload.revision_id}</Badge>
        )}
        {payload.published_at && (
          <Badge tone="muted">at {payload.published_at}</Badge>
        )}
      </div>

      {tree && Object.keys(tree).length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(tree)
            .filter(([k]) =>
              [
                'added_trees',
                'removed_trees',
                'species_changes',
                'dbh_cell_changes',
                'new_year_columns',
                'removed_year_columns',
              ].includes(k),
            )
            .map(([k, v]) => (
              <Stat key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
            ))}
        </div>
      )}

      {payload.promoted_files && (
        <div className="text-xs text-[var(--text-muted)]">
          Promoted {payload.promoted_files.length} file
          {payload.promoted_files.length === 1 ? '' : 's'} into the canonical
          dataset.
        </div>
      )}

      {payload.cache_cleared && (
        <div className="text-xs text-[var(--text-muted)]">
          Cache cleared: <code>{JSON.stringify(payload.cache_cleared)}</code>
        </div>
      )}

      <AddedTreeAuditList audits={payload.added_tree_audits} />

      <details className="text-xs text-[var(--text-muted)]">
        <summary className="cursor-pointer select-none">Full manifest</summary>
        <div className="mt-2">
          <JsonBlock value={payload} muted />
        </div>
      </details>
    </div>
  )
}

function AddedTreeAuditList({ audits }: { audits?: AddedTreeAudit[] }) {
  if (!audits || audits.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-[var(--text)]">
          Added tree audit
        </h3>
        <span className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
          dev logging
        </span>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Verifies that each added tree from the diff actually landed in the
        canonical raw CSV and the Year 0 snapshot. <code>first_year_dbh_in</code>{' '}
        is the value the user typed in the first DBH column (raw sheet is
        treated as inches); <code>year_0_dbh_cm</code> is the diameter the
        dashboard ultimately bins on (latest observed year × 2.54).
      </p>
      <ul className="space-y-2">
        {audits.map((a, i) => {
          const okRaw = a.found_in_canonical_raw === true
          const okSnap = a.found_in_canonical_snapshot_year_0 === true
          return (
            <li
              key={`${a.plot ?? 'plot'}-${a.tree_id ?? i}`}
              className="rounded-card border border-[var(--border)] bg-[var(--surface-2)]/50 p-3 text-xs"
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[var(--text)]">
                  {a.plot} · tree_id={a.tree_id}
                </span>
                {a.species && (
                  <span className="text-[var(--text-muted)]">{a.species}</span>
                )}
                <Badge tone={okRaw ? 'ok' : 'error'}>
                  {okRaw ? 'in raw' : 'missing from raw'}
                </Badge>
                <Badge tone={okSnap ? 'ok' : 'warn'}>
                  {okSnap ? 'in Year 0 snapshot' : 'missing from Year 0'}
                </Badge>
                {a.year_0_bin_label_cm && (
                  <Badge tone="default">bin {a.year_0_bin_label_cm} cm</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[var(--text-muted)] sm:grid-cols-3 lg:grid-cols-4">
                <div>
                  first_year={String(a.first_year ?? '—')}
                </div>
                <div>
                  first_year_dbh_in={String(a.first_year_dbh_in ?? '—')}
                </div>
                <div>
                  first_year_dbh_cm={String(a.first_year_dbh_cm ?? '—')}
                </div>
                <div>year_0_dbh_cm={String(a.year_0_dbh_cm ?? '—')}</div>
                {typeof a.plot_total_after_publish === 'number' && (
                  <div>
                    plot_total_after_publish={a.plot_total_after_publish}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// --- Current revision ----------------------------------------------------

function PanelCurrentRevision({ state }: { state: PanelState }) {
  return (
    <PanelShell title="Current revision" state={state}>
      {state.status === 'ok' && (
        <RevisionSummary value={state.data as Record<string, unknown>} />
      )}
    </PanelShell>
  )
}

function RevisionSummary({ value }: { value: Record<string, unknown> }) {
  const rev = value as {
    revision_id?: string
    status?: string
    published_at?: string
    recorded_at?: string
    previous_revision_id?: string | null
    plots_processed?: string[]
    tree_change_summary?: Record<string, unknown>
    source?: Record<string, unknown>
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {rev.revision_id && <Badge tone="default">{rev.revision_id}</Badge>}
        {rev.status && (
          <Badge tone={rev.status === 'published' ? 'ok' : 'warn'}>
            {rev.status}
          </Badge>
        )}
        {rev.published_at && (
          <Badge tone="muted">published {rev.published_at}</Badge>
        )}
      </div>
      {rev.plots_processed && rev.plots_processed.length > 0 && (
        <div className="text-xs text-[var(--text-muted)]">
          Plots: {rev.plots_processed.join(', ')}
        </div>
      )}
      {rev.previous_revision_id && (
        <div className="text-xs text-[var(--text-muted)]">
          Previous: <code>{rev.previous_revision_id}</code>
        </div>
      )}
      {rev.tree_change_summary && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(rev.tree_change_summary)
            .filter(([k]) =>
              [
                'added_trees',
                'removed_trees',
                'species_changes',
                'dbh_cell_changes',
              ].includes(k),
            )
            .map(([k, v]) => (
              <Stat key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
            ))}
        </div>
      )}
      <details className="text-xs text-[var(--text-muted)]">
        <summary className="cursor-pointer select-none">Full summary</summary>
        <div className="mt-2">
          <JsonBlock value={value} muted />
        </div>
      </details>
    </div>
  )
}

// --- Revisions list ------------------------------------------------------

function PanelRevisions({ state }: { state: PanelState }) {
  return (
    <PanelShell title="Revision history" state={state}>
      {state.status === 'ok' && (
        <RevisionsTable
          value={
            state.data as {
              count: number
              revisions: Array<Record<string, unknown>>
            }
          }
        />
      )}
    </PanelShell>
  )
}

function RevisionsTable({
  value,
}: {
  value: { count: number; revisions: Array<Record<string, unknown>> }
}) {
  if (!value.revisions || value.revisions.length === 0) {
    return (
      <div className="text-sm text-[var(--text-muted)]">
        No revisions recorded yet.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <th className="py-2 pr-4 font-medium">Revision</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Recorded</th>
            <th className="py-2 pr-4 font-medium">Changes</th>
          </tr>
        </thead>
        <tbody>
          {value.revisions.map((r, i) => {
            const rid = String(r.revision_id || `row-${i}`)
            const status = String(r.status || 'unknown')
            const recorded = String(r.recorded_at || r.published_at || '')
            const t = (r.tree_change_summary || {}) as Record<string, number>
            return (
              <tr key={rid} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2 pr-4 font-mono text-xs text-[var(--text)]">{rid}</td>
                <td className="py-2 pr-4">
                  <Badge tone={status === 'published' ? 'ok' : 'warn'}>
                    {status}
                  </Badge>
                </td>
                <td className="py-2 pr-4 text-xs text-[var(--text-muted)]">
                  {recorded}
                </td>
                <td className="py-2 pr-4 text-xs text-[var(--text-muted)]">
                  +{t.added_trees ?? 0}/-{t.removed_trees ?? 0} trees,{' '}
                  {t.dbh_cell_changes ?? 0} DBH
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tiny primitives
// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  compact,
}: {
  label: string
  value: string
  compact?: boolean
}) {
  return (
    <div
      className={`rounded-card border border-[var(--border)] bg-[var(--surface)] ${
        compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
        {label}
      </div>
      <div className="text-sm font-semibold text-[var(--text)]">{value}</div>
    </div>
  )
}

function Badge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?: 'default' | 'ok' | 'error' | 'warn' | 'muted'
}) {
  const tones: Record<string, string> = {
    default: 'bg-[var(--accent-light)] text-[var(--accent-text)] border-[var(--accent)]/30',
    ok: 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent-text)] border-[var(--accent)]/40',
    error: 'bg-[color-mix(in_srgb,var(--error)_10%,transparent)] text-[var(--error)] border-[var(--error)]/40',
    warn: 'bg-[color-mix(in_srgb,var(--warning,#d97706)_12%,transparent)] text-[var(--warning,#d97706)] border-[var(--warning,#d97706)]/30',
    muted: 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)]',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

function SeverityDot({ severity }: { severity?: string }) {
  const colorMap: Record<string, string> = {
    error: 'bg-[var(--error)]',
    warning: 'bg-[var(--warning,#d97706)]',
    info: 'bg-[var(--text-faint)]',
  }
  const c = colorMap[severity || 'info'] || colorMap.info
  return <span className={`mt-1 inline-block h-1.5 w-1.5 rounded-full ${c}`} />
}
