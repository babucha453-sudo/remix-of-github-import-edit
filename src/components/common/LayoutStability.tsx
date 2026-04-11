/**
 * LayoutStability - Components to prevent Cumulative Layout Shift (CLS)
 * 
 * These utility components help maintain layout stability
 * by reserving space for dynamic content.
 */

import { ReactNode, CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface AspectRatioBoxProps {
  /** Aspect ratio (width / height), e.g., 16/9 for 16:9 */
  ratio: number;
  children: ReactNode;
  className?: string;
}

/**
 * AspectRatioBox - Maintains aspect ratio to prevent CLS
 */
export const AspectRatioBox = ({
  ratio,
  children,
  className,
}: AspectRatioBoxProps) => (
  <div
    className={cn('relative w-full', className)}
    style={{ paddingBottom: `${(1 / ratio) * 100}%` }}
  >
    <div className="absolute inset-0">{children}</div>
  </div>
);

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
  /** Animation type */
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Skeleton - Loading placeholder that reserves space
 */
export const Skeleton = ({
  className,
  style,
  animation = 'pulse',
}: SkeletonProps) => (
  <div
    className={cn(
      'bg-muted rounded',
      animation === 'pulse' && 'animate-pulse',
      animation === 'wave' && 'skeleton-wave',
      className
    )}
    style={style}
  />
);

interface ContentPlaceholderProps {
  /** Expected height of content */
  height: number | string;
  /** Expected width of content */
  width?: number | string;
  className?: string;
  /** Show skeleton animation while loading */
  showSkeleton?: boolean;
}

/**
 * ContentPlaceholder - Reserves exact space for content to prevent CLS
 */
export const ContentPlaceholder = ({
  height,
  width = '100%',
  className,
  showSkeleton = true,
}: ContentPlaceholderProps) => (
  <div
    className={cn(showSkeleton && 'animate-pulse bg-muted rounded', className)}
    style={{
      height: typeof height === 'number' ? `${height}px` : height,
      width: typeof width === 'number' ? `${width}px` : width,
      minHeight: typeof height === 'number' ? `${height}px` : height,
    }}
  />
);

interface TextPlaceholderProps {
  /** Number of lines to show */
  lines?: number;
  /** Last line width (as percentage) */
  lastLineWidth?: number;
  className?: string;
}

/**
 * TextPlaceholder - Skeleton for text content
 */
export const TextPlaceholder = ({
  lines = 3,
  lastLineWidth = 60,
  className,
}: TextPlaceholderProps) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className="h-4"
        style={{
          width: i === lines - 1 ? `${lastLineWidth}%` : '100%',
        }}
      />
    ))}
  </div>
);

interface CardPlaceholderProps {
  className?: string;
  /** Include image area */
  hasImage?: boolean;
  /** Image aspect ratio */
  imageRatio?: number;
}

/**
 * CardPlaceholder - Full card skeleton with image and text
 */
export const CardPlaceholder = ({
  className,
  hasImage = true,
  imageRatio = 16 / 9,
}: CardPlaceholderProps) => (
  <div className={cn('bg-card rounded-xl border border-border/50 overflow-hidden', className)}>
    {hasImage && (
      <AspectRatioBox ratio={imageRatio}>
        <Skeleton className="w-full h-full rounded-none" />
      </AspectRatioBox>
    )}
    <div className="p-4 space-y-3">
      <Skeleton className="h-6 w-3/4" />
      <TextPlaceholder lines={2} lastLineWidth={40} />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  </div>
);

/**
 * ListPlaceholder - Skeleton for list items
 */
export const ListPlaceholder = ({
  count = 5,
  itemHeight = 72,
  className,
}: {
  count?: number;
  itemHeight?: number;
  className?: string;
}) => (
  <div className={cn('space-y-3', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton
        key={i}
        className="rounded-lg"
        style={{ height: itemHeight }}
      />
    ))}
  </div>
);

export default {
  AspectRatioBox,
  Skeleton,
  ContentPlaceholder,
  TextPlaceholder,
  CardPlaceholder,
  ListPlaceholder,
};
