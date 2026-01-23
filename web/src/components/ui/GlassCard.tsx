import { cn } from '@/lib/utils'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  hover?: boolean
}

export function GlassCard({ children, className, hover = true, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-[var(--panel)] p-6 shadow-md border border-[var(--border)]',
        hover && 'hover:shadow-lg hover:border-[var(--primary)]/30 transition-all',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
