import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
}

export function Card({ className, title, children, ...props }: CardProps) {
  return (
    <div className={cn('rounded-xl border border-zinc-800 bg-zinc-900 p-6', className)} {...props}>
      {title && <h3 className="mb-4 text-lg font-semibold text-white">{title}</h3>}
      {children}
    </div>
  );
}
