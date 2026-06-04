"use client";

import React, { useState, useEffect } from "react";
import { Skeleton } from "./Skeleton";
import { cn } from "@/lib/utils";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className,
  fallbackSrc,
  ...props
}) => {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
    setLoaded(false);
  }, [src]);

  const handleLoad = () => {
    setLoaded(true);
  };

  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setLoaded(false);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Loading Skeleton */}
      {!loaded && <Skeleton className="absolute inset-0 h-full w-full rounded-none" />}
      
      {/* Actual Image */}
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt || ""}
          loading="lazy"
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
            className
          )}
          {...props}
        />
      )}
    </div>
  );
};
