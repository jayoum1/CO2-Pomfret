'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { KEYFRAME_YEARS } from '@/lib/visualizationData'

interface VisualizationControlsProps {
  selectedYear: number
  onYearChange: (year: number) => void
  selectedPlot: string
  onPlotChange: (plot: string) => void
  plots: string[]
}

export default function VisualizationControls({
  selectedYear,
  onYearChange,
  selectedPlot,
  onPlotChange,
  plots,
}: VisualizationControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Year selector as pill buttons */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--text-muted)]">Year</span>
        <div className="inline-flex rounded-lg bg-[var(--panel2)] p-1 gap-0.5">
          {KEYFRAME_YEARS.map(y => (
            <button
              key={y}
              onClick={() => onYearChange(y)}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
                selectedYear === y
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/60'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Plot selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--text-muted)]">Plot</span>
        <Select value={selectedPlot} onValueChange={onPlotChange}>
          <SelectTrigger className="w-[140px] h-9 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plots</SelectItem>
            {plots.map(p => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
