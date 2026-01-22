import { cn } from '@/lib/utils'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  hover?: boolean
}

export function GlassCard({ children, className, hover = true, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        'glass-card',
        hover && 'hover:translate-y-[-2px]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
