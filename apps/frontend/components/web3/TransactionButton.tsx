'use client';
import { Button } from '@/components/ui/Button';
import { ButtonHTMLAttributes } from 'react';

interface TxButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isPending?: boolean;
  isSuccess?: boolean;
  label: string;
  loadingLabel?: string;
  successLabel?: string;
}

export function TransactionButton({
  isPending,
  isSuccess,
  label,
  loadingLabel = 'Confirming...',
  successLabel = 'Done!',
  className,
  ...props
}: TxButtonProps) {
  return (
    <Button isLoading={isPending} className={className} {...props}>
      {isPending ? loadingLabel : isSuccess ? successLabel : label}
    </Button>
  );
}
