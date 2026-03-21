import React from 'react';

import { cn } from '@/utils';

export const DropdownCategoryTitle = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="text-[.65rem] font-semibold mb-1.5 uppercase text-neutral-400 px-2">
      {children}
    </div>
  );
};

export const DropdownButton = React.forwardRef<
  HTMLButtonElement,
  {
    children: React.ReactNode;
    isActive?: boolean;
    onClick?: (e: React.MouseEvent<Element, MouseEvent>) => void;
    disabled?: boolean;
    className?: string;
  }
>(function DropdownButtonInner({ children, isActive, onClick, disabled, className }, ref) {
  const buttonClass = cn(
    'flex items-center gap-2 p-2 text-sm font-normal text-neutral-600 dark:text-neutral-300 text-left bg-transparent w-full rounded-md transition-all duration-150 ease-in-out',
    !isActive && !disabled && 'hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400',
    isActive && !disabled && 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    disabled && 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed',
    className,
  );

  return (
    <button className={buttonClass} disabled={disabled} onClick={onClick} ref={ref}>
      {children}
    </button>
  );
});
