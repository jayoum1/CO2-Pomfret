'use client'

import * as React from 'react'
import * as RechartsPrimitive from 'recharts'
import { cn } from '@/lib/utils'

// ── Config type ───────────────────────────────────────────────────────────────

export type ChartConfig = {
  [key: string]: {
    label: string
    color?: string
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null)

export function useChartConfig(): { config: ChartConfig } {
  const ctx = React.useContext(ChartContext)
  if (!ctx) throw new Error('useChartConfig must be used inside <ChartContainer>')
  return ctx
}

// ── ChartContainer ────────────────────────────────────────────────────────────

interface ChartContainerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  config: ChartConfig
  /** Must be a single Recharts chart element */
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children']
}

export const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ id, className, children, config, ...props }, ref) => {
    const uid = React.useId().replace(/:/g, '')
    const chartId = `chart-${id ?? uid}`

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          ref={ref}
          data-chart={chartId}
          className={cn(
            'w-full text-xs',
            // Style Recharts internal SVG text/grid via attribute selectors.
            // CSS vars automatically switch in dark mode.
            '[&_.recharts-cartesian-axis-tick_text]:fill-[var(--text-muted)]',
            '[&_.recharts-cartesian-grid_line[stroke]]:stroke-[var(--border)]',
            '[&_.recharts-polar-grid_[stroke]]:stroke-[var(--border)]',
            '[&_.recharts-sector]:outline-none',
            '[&_.recharts-surface]:outline-none',
            '[&_.recharts-layer]:outline-none',
            className,
          )}
          {...props}
        >
          <ChartStyle id={chartId} config={config} />
          <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
            {children}
          </RechartsPrimitive.ResponsiveContainer>
        </div>
      </ChartContext.Provider>
    )
  },
)
ChartContainer.displayName = 'ChartContainer'

// Inject per-chart CSS custom properties so Recharts can reference `var(--color-key)`.
const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const vars = Object.entries(config)
    .filter(([, v]) => v.color)
    .map(([k, v]) => `  --color-${k}: ${v.color};`)
    .join('\n')

  if (!vars) return null

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {\n${vars}\n}`,
      }}
    />
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

export const ChartTooltip = RechartsPrimitive.Tooltip

export interface ChartTooltipContentProps {
  active?: boolean
  payload?: Array<{
    dataKey: string | number
    name: string
    value: number
    color?: string
    fill?: string
    payload?: Record<string, unknown>
  }>
  label?: string | number
  className?: string
  hideLabel?: boolean
  indicator?: 'dot' | 'line'
  /** (value, name, item, index) → [displayValue, displayName] */
  formatter?: (
    value: number,
    name: string,
    item: unknown,
    index: number,
  ) => [React.ReactNode, string]
  labelFormatter?: (label: unknown, payload: unknown[]) => React.ReactNode
}

export const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps
>(
  (
    {
      active,
      payload,
      label,
      className,
      hideLabel = false,
      indicator = 'dot',
      formatter,
      labelFormatter,
    },
    ref,
  ) => {
    const { config } = useChartConfig()

    if (!active || !payload?.length) return null

    return (
      <div
        ref={ref}
        className={cn(
          'min-w-[9rem] rounded-lg border border-[var(--border)] dark:border-[var(--border-strong)] bg-[var(--surface)] dark:bg-[var(--surface-3)] px-3 py-2 text-xs shadow-xl dark:shadow-[0_4px_20px_rgba(0,0,0,0.6)]',
          className,
        )}
      >
        {!hideLabel && (
          <p className="mb-1.5 font-semibold text-[var(--text)]">
            {labelFormatter ? labelFormatter(label, payload) : label}
          </p>
        )}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = String(item.dataKey)
            const cfg = config[key]
            const color = cfg?.color ?? item.color ?? item.fill ?? '#14b8a6'
            const name = cfg?.label ?? item.name

            const [displayValue, displayName] = formatter
              ? formatter(item.value, item.name, item, index)
              : [item.value?.toLocaleString?.() ?? item.value, name]

            return (
              <div key={key + index} className="flex items-center gap-2 leading-none">
                {indicator === 'dot' ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                ) : (
                  <span
                    className="h-px w-4 shrink-0"
                    style={{ backgroundColor: color }}
                  />
                )}
                <span className="text-slate-500">{displayName}</span>
                <span className="ml-auto font-mono font-semibold tabular-nums text-slate-800">
                  {displayValue}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)
ChartTooltipContent.displayName = 'ChartTooltipContent'

// ── Legend ────────────────────────────────────────────────────────────────────

export const ChartLegend = RechartsPrimitive.Legend

export interface ChartLegendContentProps {
  payload?: Array<{ value: string; color?: string; dataKey?: string }>
  verticalAlign?: 'top' | 'bottom'
  className?: string
}

export const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  ChartLegendContentProps
>(({ payload, verticalAlign = 'bottom', className }, ref) => {
  const { config } = useChartConfig()
  if (!payload?.length) return null

  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-wrap items-center justify-center gap-4 text-xs',
        verticalAlign === 'top' ? 'pb-3' : 'pt-3',
        className,
      )}
    >
      {payload.map(item => {
        const key = item.dataKey ?? item.value
        const cfg = config[key] ?? config[item.value]
        const label = cfg?.label ?? item.value
        const color = cfg?.color ?? item.color

        return (
          <div key={item.value} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-slate-500">{label}</span>
          </div>
        )
      })}
    </div>
  )
})
ChartLegendContent.displayName = 'ChartLegendContent'
