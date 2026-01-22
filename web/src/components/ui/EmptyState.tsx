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
    <div className={cn('flex flex-col items-center justify-center py-12 px-4', className)}>
      {Icon && (
        <div className="p-4 rounded-full bg-[var(--panel2)] mb-4">
          <Icon className="h-8 w-8 text-[var(--muted)]" />
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
