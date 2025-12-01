import React from 'react';
import { cn } from "@/lib/utils"
import { Skeleton } from "./skeleton"

/**
 * Mobile-optimized skeleton components for common data patterns
 */

interface TankCardSkeletonProps {
  className?: string;
}

/**
 * Skeleton for tank status cards - matches the tank card layout
 */
export function TankCardSkeleton({ className }: TankCardSkeletonProps) {
  return (
    <div className={cn(
      "rounded-lg border bg-card p-4 space-y-3",
      className
    )}>
      {/* Header with status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      {/* Progress bar */}
      <Skeleton className="h-2 w-full rounded-full" />

      {/* Stats row */}
      <div className="flex justify-between text-sm">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* Footer with location */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

interface TankGridSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Skeleton grid for tank cards - responsive layout
 */
export function TankGridSkeleton({ count = 6, className }: TankGridSkeletonProps) {
  return (
    <div className={cn(
      "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      className
    )}>
      {Array.from({ length: count }).map((_, index) => (
        <TankCardSkeleton key={index} />
      ))}
    </div>
  );
}

interface DashboardStatSkeletonProps {
  className?: string;
}

/**
 * Skeleton for dashboard stat cards (KPI cards)
 */
export function DashboardStatSkeleton({ className }: DashboardStatSkeletonProps) {
  return (
    <div className={cn(
      "rounded-lg border bg-card p-4 space-y-2",
      className
    )}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

interface DashboardStatsGridSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Skeleton grid for dashboard stats - responsive
 */
export function DashboardStatsGridSkeleton({ count = 4, className }: DashboardStatsGridSkeletonProps) {
  return (
    <div className={cn(
      "grid gap-4 grid-cols-2 md:grid-cols-4",
      className
    )}>
      {Array.from({ length: count }).map((_, index) => (
        <DashboardStatSkeleton key={index} />
      ))}
    </div>
  );
}

interface MobileListSkeletonProps {
  items?: number;
  className?: string;
}

/**
 * Skeleton for mobile list views - optimized for touch interfaces
 */
export function MobileListSkeleton({ items = 5, className }: MobileListSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: items }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 p-3 rounded-lg border bg-card"
        >
          {/* Icon/Avatar */}
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />

          {/* Content */}
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>

          {/* Action indicator */}
          <Skeleton className="h-6 w-6 rounded flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

interface ChartContainerSkeletonProps {
  className?: string;
  height?: number;
}

/**
 * Skeleton for chart containers with title and legend
 */
export function ChartContainerSkeleton({ className, height = 200 }: ChartContainerSkeletonProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded" />
          <Skeleton className="h-6 w-16 rounded" />
        </div>
      </div>

      {/* Chart area */}
      <Skeleton className="w-full rounded" style={{ height }} />

      {/* Legend */}
      <div className="flex justify-center gap-4">
        <div className="flex items-center gap-1">
          <Skeleton className="h-3 w-3 rounded" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-3 w-3 rounded" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

interface PageSkeletonProps {
  className?: string;
}

/**
 * Full page skeleton with header, stats, and content area
 */
export function PageSkeleton({ className }: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6 p-4", className)}>
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Stats grid */}
      <DashboardStatsGridSkeleton />

      {/* Content area */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-24 rounded" />
        </div>
        <TankGridSkeleton count={6} />
      </div>
    </div>
  );
}

/**
 * Inline loading indicator for buttons/actions
 */
export function InlineLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}
