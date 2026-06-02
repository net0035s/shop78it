import { ProductCardSkeleton } from '@/components/product/ProductCardSkeleton'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="animate-fade-in">
      <section className="relative min-h-[70vh] overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute inset-0 bg-hero-gradient" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-3xl space-y-6">
            <Skeleton className="h-9 w-48 rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-12 w-full max-w-2xl" />
              <Skeleton className="h-12 w-4/5 max-w-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-full max-w-xl" />
              <Skeleton className="h-5 w-2/3 max-w-md" />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Skeleton className="h-14 w-full sm:w-44 rounded-xl" />
              <Skeleton className="h-14 w-full sm:w-36 rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      <section id="products" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-24" />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Skeleton className="h-11 w-full max-w-sm rounded-xl" />
          <Skeleton className="h-11 w-44 rounded-xl" />
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-28 rounded-full" />
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </section>
    </div>
  )
}
