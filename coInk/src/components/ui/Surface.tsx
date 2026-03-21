import { HTMLProps, forwardRef } from 'react';

import { cn } from '@/utils';

export type SurfaceProps = HTMLProps<HTMLDivElement> & {
  withShadow?: boolean;
  withBorder?: boolean;
  elevation?: 'low' | 'medium' | 'high';
};

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  (
    { children, className, withShadow = true, withBorder = true, elevation = 'medium', ...props },
    ref,
  ) => {
    const shadowClasses = {
      low: 'shadow-sm',
      medium: 'shadow',
      high: 'shadow-lg',
    };

    const surfaceClass = cn(
      'bg-white dark:bg-gray-800 rounded-xl max-w-full box-border',
      withShadow ? shadowClasses[elevation] : '',
      withBorder ? 'border border-neutral-100 dark:border-gray-700' : '',
      className,
    );

    return (
      <div className={surfaceClass} data-surface {...props} ref={ref}>
        {children}
      </div>
    );
  },
);

Surface.displayName = 'Surface';
