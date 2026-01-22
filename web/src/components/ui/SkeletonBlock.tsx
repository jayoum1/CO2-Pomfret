import { cn } from '@/lib/utils'

interface SkeletonBlockProps {
  className?: string
  lines?: number
}

export function SkeletonBlock({ className, lines = 1 }: SkeletonBlockProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-4 rounded"
          style={{
            width: i === lines - 1 ? '75%' : '100%',
          }}
        />
      ))}
    </div>
  )
}
