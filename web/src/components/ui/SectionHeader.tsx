import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}

export function SectionHeader({ title, subtitle, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between mb-6 gap-4', className)}>
      <div className="min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-faint)] mb-1">Section</p>
        <h2 className="text-heading-2">{title}</h2>
        {subtitle && (
          <p className="text-label mt-2 normal-case tracking-normal font-sans text-[13px] leading-snug text-[var(--text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
