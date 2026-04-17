import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

/**
 * Standard responsive page wrapper.
 * Uses full available width with compact padding at small viewports.
 * Import and wrap every page's top-level div with this.
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('w-full px-3 sm:px-5 lg:px-8 py-4 sm:py-6 space-y-6', className)}>
      {children}
    </div>
  )
}
