import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'toolbar' | 'ghost' | 'danger' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  className?: string;
}

export const Button = ({
  children,
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) => {
  const baseStyle =
    'inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border font-black transition-all disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.99]';

  const sizeStyle = {
    sm: 'min-h-[var(--ui-button-h)] px-4 py-2 text-[var(--ui-font-button)]',
    md: 'min-h-[var(--ui-button-h)] px-4 py-2 text-[var(--ui-font-button)]',
    lg: 'min-h-[var(--ui-button-h)] px-5 py-3 text-[var(--ui-font-button)]',
  };

  const variants: Record<ButtonVariant, string> = {
    primary:
      'border-[var(--ui-primary)] bg-[var(--ui-primary)] text-[var(--ui-on-primary)] shadow-[var(--ui-shadow-control)] hover:bg-[var(--ui-primary-hover)]',
    secondary:
      'border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--text-main)] shadow-[var(--ui-shadow-control)] hover:bg-[var(--ui-secondary)]',
    toolbar:
      'border-[var(--ui-toolbar-action-border)] bg-[var(--ui-toolbar-action-bg)] text-[var(--ui-toolbar-action-text)] shadow-[var(--ui-shadow-control)] hover:bg-[var(--ui-toolbar-action-hover)]',
    ghost:
      'border-transparent bg-transparent text-[var(--text-main)] shadow-none hover:bg-[var(--ui-secondary)]',
    danger:
      'border-[var(--ui-danger)] bg-transparent text-[var(--ui-danger)] shadow-none hover:bg-[var(--ui-soft-danger)]',
    icon:
      'h-[var(--ui-icon-hit)] w-[var(--ui-icon-hit)] rounded-[var(--ui-radius-control)] border-[var(--ui-border)] bg-[var(--ui-surface)] p-0 text-[var(--text-main)] shadow-[var(--ui-shadow-control)] hover:bg-[var(--ui-secondary)]',
  };

  return (
    <button
      className={`${baseStyle} ${sizeStyle[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

