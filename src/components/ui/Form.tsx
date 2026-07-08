import React from 'react';

interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children?: React.ReactNode;
  className?: string;
}

export const Form = ({ children, className = '', ...props }: FormProps) => {
  return (
    <form {...props} className={className}>
      {children}
    </form>
  );
};
