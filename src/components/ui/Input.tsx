import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  label?: string;
  className?: string;
}

export const Input = ({ className = '', icon, label, id, ...props }: InputProps) => {
  const inputId = id || props.name;

  return (
    <div className="relative w-full min-w-0">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[var(--text-soft)]"
        >
          {label}
        </label>
      )}
      {icon && (
        <div className={`pointer-events-none absolute left-3 ${label ? 'top-[calc(50%+0.45rem)]' : 'top-1/2'} -translate-y-1/2 text-[var(--text-soft)]`}>
          {icon}
        </div>
      )}
      <input
        id={inputId}
        className={`w-full min-w-0 min-h-[var(--ui-control-h)] rounded-[var(--ui-radius-control)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-2 text-[length:var(--ui-font-body)] font-bold text-[var(--text-main)] outline-none transition-colors placeholder:text-[var(--text-soft)]/70 ${
          icon ? 'pl-10' : ''
        } ${className}`}
        {...props}
      />
    </div>
  );
};


