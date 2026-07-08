import React from 'react';
import { Card } from './Card';

interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
  children?: React.ReactNode;
  maxWidthClassName?: string;
}

export const Modal = ({ open, children, className = '', maxWidthClassName = 'max-w-3xl', ...props }: ModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-[var(--ui-card-pad)]">
      <Card
        elevated
        {...props}
        className={`max-h-[90dvh] w-full overflow-auto rounded-[var(--ui-radius-modal)] ${maxWidthClassName} ${className}`}
      >
        {children}
      </Card>
    </div>
  );
};

