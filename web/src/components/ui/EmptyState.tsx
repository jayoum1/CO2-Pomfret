import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 rounded-panel border border-dashed border-[color-mix(in_srgb,var(--border)_85%,var(--primary))] bg-[color-mix(in_srgb,var(--surface)_92%,var(--surface-2))]',
        className,
      )}
    >
      {Icon && (
        <div className="p-4 rounded-full border border-[var(--border)] bg-[var(--surface-2)] mb-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <Icon className="h-8 w-8 text-[var(--text-muted)]" strokeWidth={1.25} />
        </div>
      )}
      <h3 className="text-heading-3 text-[var(--text)] mb-2">{title}</h3>
      {description && (
        <p className="text-body text-[var(--muted)] text-center max-w-md mb-6">
          {description}
        </p>
      )}
      {action && action}
    </div>
  )
}
