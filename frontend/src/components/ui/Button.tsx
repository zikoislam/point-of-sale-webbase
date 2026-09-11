import React from 'react';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses = {
  primary:
    'bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md shadow-blue-900/20 active:bg-blue-700 border border-blue-500/30',
  secondary:
    'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 active:bg-slate-900',
  danger:
    'bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-md shadow-rose-900/20 active:bg-rose-700 border border-rose-500/30',
  success:
    'bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-900/20 active:bg-emerald-700 border border-emerald-500/30',
  warning:
    'bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-md shadow-amber-900/20 active:bg-amber-700 border border-amber-500/30',
  outline:
    'bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white border border-slate-700 active:bg-slate-800',
  ghost:
    'bg-transparent hover:bg-slate-800/80 text-slate-400 hover:text-slate-100 border border-transparent',
};

const sizeClasses = {
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-lg gap-2',
  lg: 'h-12 px-6 text-base rounded-xl gap-2.5',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref
  ) => {
    const isActuallyLoading = loading || isLoading;
    const isDisabled = disabled || isActuallyLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center select-none font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
          variantClasses[variant],
          sizeClasses[size],
          isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          className
        )}
        {...props}
      >
        {isActuallyLoading ? (
          <Spinner
            size={size === 'lg' ? 'md' : 'sm'}
            color={variant === 'primary' || variant === 'danger' || variant === 'success' ? 'white' : 'current'}
          />
        ) : (
          leftIcon && <span className="inline-flex shrink-0 items-center">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && (
          <span className="inline-flex shrink-0 items-center">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
