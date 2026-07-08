import React from 'react';

interface DataTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children?: React.ReactNode;
  wrapperClassName?: string;
}

export const DataTable = ({ children, className = '', wrapperClassName = '', ...props }: DataTableProps) => {
  return (
    <div className={`jrk-table-frame min-w-0 overflow-hidden ${wrapperClassName}`}>
      <div className="w-full overflow-x-auto">
        <table {...props} className={`min-w-full text-left text-[length:var(--ui-font-body)] ${className}`}>
          {children}
        </table>
      </div>
    </div>
  );
};

