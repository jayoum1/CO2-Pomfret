import { LucideIcon } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  delta?: {
    value: string | number
    trend: 'up' | 'down' | 'neutral'
  }
  icon?: LucideIcon
  description?: string
  className?: string
}

export function KpiCard({ 
  title, 
  value, 
  delta, 
  icon: Icon, 
  description,
  className 
}: KpiCardProps) {
  const deltaColor = delta?.trend === 'up' 
    ? 'text-[var(--success)]' 
    : delta?.trend === 'down'
    ? 'text-[var(--error)]'
    : 'text-[var(--muted)]'

  return (
    <GlassCard className={cn('p-6', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-label mb-2">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-heading-2 text-[var(--text)]">{value}</p>
            {delta && (
              <span className={cn('text-sm font-medium', deltaColor)}>
                {delta.trend === 'up' ? '↑' : delta.trend === 'down' ? '↓' : '→'} {delta.value}
              </span>
            )}
          </div>
          {description && (
            <p className="text-label mt-2 text-[var(--muted)]">{description}</p>
          )}
        </div>
        {Icon && (
          <div className="p-2 rounded-lg bg-[var(--accent)]">
            <Icon className="h-5 w-5 text-[var(--primary)]" />
          </div>
        )}
      </div>
    </GlassCard>
  )
}
