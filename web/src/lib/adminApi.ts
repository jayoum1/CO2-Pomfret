/**
 * Browser-side client for the FastAPI admin pipeline routes.
 *
 * By default the backend requires an `X-Admin-Token` header matching
 * `CO2_ADMIN_TOKEN`. For local-only development the backend can set
 * `CO2_DISABLE_ADMIN_AUTH=true` — then omit the header by leaving the
 * token field blank in the admin UI. Service-account credentials are
 * never sent from the frontend; only the Python process reads them.
 */

export type AdminTabs = {
  Lower?: string
  Middle?: string
  Upper?: string
}

export type AdminSheetOverrides = {
  spreadsheet_id?: string
  tabs?: AdminTabs
  public_csv?: boolean
}

export type AdminPublishOverrides = AdminSheetOverrides & {
  include_nn_epsilon?: boolean
}

export type AdminErrorShape = {
  status: number
  message: string
  detail?: unknown
}

export class AdminApiError extends Error {
  status: number
  detail?: unknown
  constructor(payload: AdminErrorShape) {
    super(payload.message)
    this.name = 'AdminApiError'
    this.status = payload.status
    this.detail = payload.detail
  }
}

function cleanOverrides<T extends AdminSheetOverrides>(input: T): T {
  const out: Record<string, unknown> = {}
  if (input.spreadsheet_id?.trim()) out.spreadsheet_id = input.spreadsheet_id.trim()
  if (input.tabs) {
    const tabs: Record<string, string> = {}
    for (const k of ['Lower', 'Middle', 'Upper'] as const) {
      const v = input.tabs[k]?.trim()
      if (v) tabs[k] = v
    }
    if (Object.keys(tabs).length > 0) out.tabs = tabs
  }
  if (typeof input.public_csv === 'boolean') out.public_csv = input.public_csv
  if ('include_nn_epsilon' in input && typeof (input as AdminPublishOverrides).include_nn_epsilon === 'boolean') {
    out.include_nn_epsilon = (input as AdminPublishOverrides).include_nn_epsilon
  }
  return out as T
}

function buildHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const t = token?.trim()
  if (t) {
    headers['X-Admin-Token'] = t
  }
  return headers
}

async function request<T = unknown>(
  base: string,
  path: string,
  token: string | undefined,
  init?: RequestInit,
): Promise<T> {
  const url = `${base.replace(/\/$/, '')}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: buildHeaders(token),
    })
  } catch (e) {
    throw new AdminApiError({
      status: 0,
      message: `Cannot reach the backend at ${base}. Is FastAPI running?`,
      detail: String(e),
    })
  }

  const text = await res.text()
  let parsed: unknown = undefined
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (!res.ok) {
    let message: string = res.statusText || `HTTP ${res.status}`
    const detail = (parsed as { detail?: unknown })?.detail
    if (typeof detail === 'string' && detail.trim()) {
      message = detail
    } else if (detail && typeof detail === 'object' && 'error' in detail && typeof (detail as { error: unknown }).error === 'string') {
      message = (detail as { error: string }).error
    }
    throw new AdminApiError({ status: res.status, message, detail: parsed })
  }
  return parsed as T
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

export function checkAdminHealth(base: string, token?: string) {
  return request<Record<string, unknown>>(base, '/admin/health', token)
}

export function previewSheetSync(
  base: string,
  token: string | undefined,
  overrides: AdminSheetOverrides,
) {
  return request<Record<string, unknown>>(base, '/admin/preview-sheet-sync', token, {
    method: 'POST',
    body: JSON.stringify(cleanOverrides(overrides)),
  })
}

export function getLatestPreview(base: string, token?: string) {
  return request<Record<string, unknown>>(base, '/admin/latest-preview', token)
}

export function publishSheetSync(
  base: string,
  token: string | undefined,
  overrides: AdminPublishOverrides,
) {
  return request<Record<string, unknown>>(base, '/admin/publish-sheet-sync', token, {
    method: 'POST',
    body: JSON.stringify(cleanOverrides(overrides)),
  })
}

export function getCurrentRevision(base: string, token?: string) {
  return request<Record<string, unknown>>(base, '/admin/current-revision', token)
}

export function getRevisions(base: string, token?: string) {
  return request<{ count: number; revisions: Array<Record<string, unknown>> }>(
    base,
    '/admin/revisions',
    token,
  )
}

export function getRevisionById(base: string, revisionId: string, token?: string) {
  const enc = encodeURIComponent(revisionId)
  return request<Record<string, unknown>>(base, `/admin/revisions/${enc}`, token)
}
