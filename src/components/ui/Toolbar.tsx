import React from 'react';

interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  compact?: boolean;
}

export const Toolbar = ({ children, className = '', compact = false, ...props }: ToolbarProps) => {
  return (
    <div
      {...props}
      className={`flex min-w-0 flex-wrap items-center gap-[var(--ui-gap-button)] rounded-[var(--ui-radius-card)] border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-none ${compact ? 'p-[var(--ui-card-pad-sm)]' : 'p-[var(--ui-card-pad)]'} ${className}`}
    >
      {children}
    </div>
  );
};

