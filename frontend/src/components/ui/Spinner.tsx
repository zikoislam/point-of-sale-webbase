import React from 'react';
import { cn } from '../../lib/utils';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'white' | 'current' | 'green' | 'amber' | 'red';
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-3',
  xl: 'h-12 w-12 border-4',
};

const colorClasses = {
  primary: 'border-blue-500/30 border-t-blue-500',
  white: 'border-white/30 border-t-white',
  current: 'border-current/30 border-t-current',
  green: 'border-emerald-500/30 border-t-emerald-500',
  amber: 'border-amber-500/30 border-t-amber-500',
  red: 'border-rose-500/30 border-t-rose-500',
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className,
  ...props
}) => {
  return (
    <div
      role="status"
      aria-label="loading"
      className={cn(
        'inline-block animate-spin rounded-full',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};
