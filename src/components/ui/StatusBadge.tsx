import React from 'react';

type StatusTone = 'default' | 'success' | 'warning' | 'danger' | 'primary';

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  children?: React.ReactNode;
}

export const StatusBadge = ({ tone = 'default', children, className = '', ...props }: StatusBadgeProps) => {
  const toneClass: Record<StatusTone, string> = {
    default: 'border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--text-main)]',
    success: 'border-[var(--ui-success)] bg-[color-mix(in_srgb,var(--ui-success)_16%,var(--ui-surface))] text-[var(--text-main)]',
    warning: 'border-[var(--ui-warning)] bg-[color-mix(in_srgb,var(--ui-warning)_18%,var(--ui-surface))] text-[var(--text-main)]',
    danger: 'border-[var(--ui-danger)] bg-[color-mix(in_srgb,var(--ui-danger)_14%,var(--ui-surface))] text-[var(--text-main)]',
    primary: 'border-[var(--ui-primary)] bg-[color-mix(in_srgb,var(--ui-primary)_14%,var(--ui-surface))] text-[var(--text-main)]',
  };

  return (
    <span
      {...props}
      className={`inline-flex min-h-[28px] min-w-[4rem] items-center justify-center rounded-lg border px-2.5 py-1 text-center text-[11px] font-black ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  );
};
