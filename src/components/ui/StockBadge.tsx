'use client'

import { StockStatus } from '@/types'
import { STOCK_STATUS_CONFIG } from '@/lib/stock'
import { cn } from '@/lib/utils'

interface StockBadgeProps {
  status: StockStatus
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showDot?: boolean
}

export function StockBadge({
  status,
  className,
  size = 'md',
  showDot = true,
}: StockBadgeProps) {
  const normalized = (typeof status === 'string' ? status.toLowerCase().replace(/_/g, '-') : status) as StockStatus
  const config = STOCK_STATUS_CONFIG[normalized] || STOCK_STATUS_CONFIG['out-of-stock']

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        config.bgColor,
        config.color,
        config.borderColor,
        sizeClasses[size],
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            'rounded-full flex-shrink-0',
            config.dotColor,
            dotSizes[size],
            status === 'in-stock' && 'animate-pulse'
          )}
        />
      )}
      {config.label}
    </span>
  )
}
