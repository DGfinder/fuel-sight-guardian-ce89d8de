import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function SkeletonTankCard() {
  return (
    <Card className="border-2 bg-gray-50 border-gray-200">
      <CardContent className="p-4 space-y-3">
        {/* Header with location and status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-3 w-20 mt-1" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>

        {/* Fuel level progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>

        {/* Key metrics in grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Current volume */}
          <div className="flex items-center gap-1">
            <Skeleton className="h-3 w-3 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-2 w-8" />
            </div>
          </div>

          {/* Days to minimum */}
          <div className="flex items-center gap-1">
            <Skeleton className="h-3 w-3 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-2 w-10" />
            </div>
          </div>

          {/* Rolling average */}
          <div className="flex items-center gap-1">
            <Skeleton className="h-3 w-3 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-2 w-8" />
            </div>
          </div>

          {/* Last reading */}
          <div className="flex items-center gap-1">
            <Skeleton className="h-3 w-3 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-2 w-12" />
            </div>
          </div>
        </div>

        {/* Touch instruction hint */}
        <div className="text-center border-t pt-2">
          <Skeleton className="h-3 w-24 mx-auto" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SkeletonTankGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 pb-20">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonTankCard key={index} />
      ))}
    </div>
  );
}