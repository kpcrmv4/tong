import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  className?: string;
  wrapperClassName?: string;
}

export const Select = ({ label, className = '', wrapperClassName = 'w-full', id, children, ...props }: SelectProps) => {
  const selectId = id || props.name;

  return (
    <div className={`relative min-w-0 ${wrapperClassName}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[var(--text-soft)]"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full min-w-0 min-h-[var(--ui-control-h)] appearance-none rounded-[var(--ui-radius-control)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-2 text-[length:var(--ui-font-body)] font-bold text-[var(--text-main)] outline-none transition-colors ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
};


