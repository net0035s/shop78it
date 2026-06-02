import { Skeleton } from '@/components/ui/Skeleton'

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card-gradient">
      <div className="relative h-48 bg-surfaceLight">
        <div className="absolute left-3 top-3 flex gap-2">
          <Skeleton className="h-6 w-14 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="absolute right-3 top-3">
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-full w-full rounded-none opacity-70" />
      </div>

      <div className="space-y-4 p-5">
        <Skeleton className="h-3 w-24" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-2/3" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <Skeleton className="h-4 w-40" />
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  )
}
