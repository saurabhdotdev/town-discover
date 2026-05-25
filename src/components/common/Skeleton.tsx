"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <motion.div
      animate={{ opacity: [0.42, 0.76, 0.42] }}
      transition={{
        duration: 1.4,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={cn("rounded-lg bg-[var(--panel-soft)]", className)}
    />
  );
};

export const CardSkeleton = () => (
  <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel-soft)]">
    <Skeleton className="h-44 w-full sm:h-52" />
    <div className="space-y-3 p-4">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="grid grid-cols-2 gap-2 pt-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  </div>
);

export const DiscoverySectionSkeleton = () => (
  <div className="space-y-4 py-6">
    <Skeleton className="h-8 w-56" />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  </div>
);

export const MapSkeleton = () => (
  <div className="h-full min-h-full w-full overflow-hidden rounded-lg border border-[var(--border)]">
    <Skeleton className="h-full w-full" />
  </div>
);
