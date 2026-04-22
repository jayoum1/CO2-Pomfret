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
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">

      {/* Year pill selector */}
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-medium text-[var(--text-muted)]">Year</span>
        <div className="flex rounded-control bg-[var(--surface-2)] p-0.5 gap-0.5">
          {KEYFRAME_YEARS.map(y => (
            <button
              key={y}
              onClick={() => onYearChange(y)}
              className={`
                px-3.5 py-1.5 rounded-pill text-sm font-medium transition-all duration-150
                ${selectedYear === y
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'}
              `}
            >
              {y === 0 ? 'Now' : `+${y}`}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="hidden sm:block h-5 w-px bg-[var(--border)]" />

      {/* Plot selector */}
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-medium text-[var(--text-muted)]">Plot</span>
        <Select value={selectedPlot} onValueChange={onPlotChange}>
          <SelectTrigger className="h-8 w-[140px] bg-white text-sm">
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
