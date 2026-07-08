import React from 'react';

interface CardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  elevated?: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
}

export const Card = ({
  children,
  className = '',
  elevated = false,
  title,
  description,
  ...props
}: CardProps) => {
  return (
    <section
      {...props}
      className={`min-w-0 rounded-[var(--ui-radius-card)] border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--text-main)] ${
        elevated ? 'shadow-soft' : ''
      } ${className}`}
    >
      {(title || description) && (
        <div className="border-b border-[var(--ui-border)] p-[var(--ui-card-pad)] pb-[var(--ui-card-pad-sm)]">
          {title && <h3 className="text-lg font-black text-[var(--text-main)]">{title}</h3>}
          {description && <p className="mt-1 text-[length:var(--ui-font-label)] font-bold text-[var(--text-soft)]">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
};

