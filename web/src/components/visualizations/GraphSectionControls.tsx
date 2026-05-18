'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { KEYFRAME_YEARS } from '@/lib/visualizationData'

interface GraphSectionControlsProps {
  selectedYear: number
  onYearChange: (year: number) => void
  selectedPlot: string
  onPlotChange: (plot: string) => void
  plots: string[]
}

export default function GraphSectionControls({
  selectedYear,
  onYearChange,
  selectedPlot,
  onPlotChange,
  plots,
}: GraphSectionControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">

      {/* Year pill selector */}
      <div className="flex items-center gap-2.5">
        <span className="text-label text-[var(--text-faint)]">Year</span>
        <div className="flex rounded-control border border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[var(--surface-2)] p-0.5 gap-0.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
          {KEYFRAME_YEARS.map(y => (
            <button
              key={y}
              type="button"
              onClick={() => onYearChange(y)}
              className={`
                px-3.5 py-1.5 rounded-pill text-sm font-medium transition-all duration-150
                ${selectedYear === y
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-[0_1px_8px_var(--primary-glow)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'}
              `}
            >
              {y === 0 ? 'Now' : `+${y}`}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="hidden sm:block h-5 w-px bg-[color-mix(in_srgb,var(--border)_80%,transparent)]" />

      {/* Plot selector */}
      <div className="flex items-center gap-2.5">
        <span className="text-label text-[var(--text-faint)]">Plot</span>
        <Select value={selectedPlot} onValueChange={onPlotChange}>
          <SelectTrigger className="h-8 w-[140px] bg-[var(--surface)] border-[var(--border)] text-sm font-medium shadow-[var(--shadow-soft)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plots</SelectItem>
            {plots.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

    </div>
  )
}
