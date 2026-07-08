import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  className?: string;
}

export const Textarea = ({ label, className = '', id, ...props }: TextareaProps) => {
  const textareaId = id || props.name;

  return (
    <div className="relative w-full min-w-0">
      {label && (
        <label
          htmlFor={textareaId}
          className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[var(--text-soft)]"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`w-full min-w-0 min-h-[var(--ui-control-h)] rounded-[var(--ui-radius-control)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-2 text-[length:var(--ui-font-body)] font-bold text-[var(--text-main)] outline-none transition-colors placeholder:text-[var(--text-soft)]/70 ${className}`}
        {...props}
      />
    </div>
  );
};


