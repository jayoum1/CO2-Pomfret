// usePublishSync — keep client-side data in sync with the live published dataset.
//
// Two complementary signals drive a refetch:
//
// 1. BroadcastChannel ("co2-publish-events") — when the admin page successfully
//    publishes a revision, it broadcasts an event so any open dashboard tab
//    refetches immediately (no polling latency).
// 2. GET /dataset-version polling — for the case where the user opens the
//    dashboard later, or where BroadcastChannel isn't available (rare). The
//    endpoint is cheap (a single JSON read on the backend) so we poll on a 15s
//    interval.
//
// This hook is read-only ("enabled" defaults to true) and never writes to the
// channel itself. The admin page calls notifyPublishSucceeded() to emit events.

'use client'

import { useEffect, useRef, useState } from 'react'

import { getDatasetVersion, type DatasetVersion } from './api'

const CHANNEL_NAME = 'co2-publish-events'
const STORAGE_KEY = 'co2-publish-version-v1'
const DEFAULT_POLL_INTERVAL_MS = 15_000

export type PublishEvent = {
  type: 'publish-succeeded'
  revision_id: string | null
  published_at: string | null
  ts: number
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    return new BroadcastChannel(CHANNEL_NAME)
  } catch {
    return null
  }
}

function versionsDiffer(a: DatasetVersion | null, b: DatasetVersion | null) {
  if (!a || !b) return Boolean(a) !== Boolean(b)
  return a.revision_id !== b.revision_id || a.published_at !== b.published_at
}

interface UsePublishSyncOptions {
  /** Disable polling/listening (e.g. on routes that have no live data). */
  enabled?: boolean
  /** Polling cadence in ms. */
  pollIntervalMs?: number
}

interface UsePublishSyncResult {
  /** Latest dataset version observed by this client (null until first poll). */
  version: DatasetVersion | null
  /** Increments by 1 every time we detect a NEW publish. Use as a refetch key. */
  refreshKey: number
  /** Manual force-refresh (e.g. for a "Refresh data" button). */
  forceRefresh: () => void
}

export function usePublishSync(
  options: UsePublishSyncOptions = {},
): UsePublishSyncResult {
  const { enabled = true, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS } = options

  const [version, setVersion] = useState<DatasetVersion | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const lastSeenRef = useRef<DatasetVersion | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function poll() {
      const next = await getDatasetVersion()
      if (cancelled) return
      if (!next) return
      if (versionsDiffer(lastSeenRef.current, next)) {
        const isFirst = lastSeenRef.current === null
        lastSeenRef.current = next
        setVersion(next)
        if (!isFirst) setRefreshKey((n) => n + 1)
      }
    }

    poll()
    const id = window.setInterval(poll, pollIntervalMs)

    const channel = getBroadcastChannel()
    const onMessage = (ev: MessageEvent<PublishEvent>) => {
      if (!ev?.data || ev.data.type !== 'publish-succeeded') return
      // Trigger an immediate poll so we update `version` and bump
      // `refreshKey` from the same code path as the polling case.
      poll()
    }
    channel?.addEventListener('message', onMessage)

    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== STORAGE_KEY) return
      poll()
    }
    window.addEventListener('storage', onStorage)

    return () => {
      cancelled = true
      window.clearInterval(id)
      channel?.removeEventListener('message', onMessage)
      channel?.close()
      window.removeEventListener('storage', onStorage)
    }
  }, [enabled, pollIntervalMs])

  return {
    version,
    refreshKey,
    forceRefresh: () => setRefreshKey((n) => n + 1),
  }
}

/**
 * Called by the admin page after a successful publish so any dashboard tab
 * already open refetches without waiting for the poll interval. Also writes
 * to localStorage as a fallback for browsers without BroadcastChannel.
 */
export function notifyPublishSucceeded(payload: {
  revision_id: string | null
  published_at: string | null
}): void {
  if (typeof window === 'undefined') return
  const event: PublishEvent = {
    type: 'publish-succeeded',
    revision_id: payload.revision_id,
    published_at: payload.published_at,
    ts: Date.now(),
  }
  const channel = getBroadcastChannel()
  try {
    channel?.postMessage(event)
  } finally {
    channel?.close()
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(event))
  } catch {
    // ignore quota / private mode errors
  }
}
