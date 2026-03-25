'use client';
import React from 'react';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

export interface RadioGroupCardItem {
  id: string;
  label: string;
  description?: string;
  badge?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface RadioGroupCardProps {
  items: RadioGroupCardItem[];
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  columns?: 1 | 2 | 3;
}

export function RadioGroupCard({
  items,
  value,
  onValueChange,
  className,
  columns = 2,
}: RadioGroupCardProps) {
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  }[columns];

  return (
    <RadioGroup.Root
      value={value}
      onValueChange={onValueChange}
      className={cn('grid gap-3', gridClass, className)}
    >
      {items.map((item) => (
        <RadioGroupCardItem key={item.id} item={item} isSelected={value === item.id} />
      ))}
    </RadioGroup.Root>
  );
}

interface RadioGroupCardItemProps {
  item: RadioGroupCardItem;
  isSelected: boolean;
}

function RadioGroupCardItem({ item, isSelected }: RadioGroupCardItemProps) {
  return (
    <RadioGroup.Item
      value={item.id}
      disabled={item.disabled}
      className={cn(
        'relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5E99] focus-visible:ring-offset-2',
        isSelected
          ? 'border-[#2E5E99] bg-[#2E5E99]/5 shadow-sm'
          : 'border-border bg-card hover:border-[#7BA4D0] hover:bg-muted/30',
        item.disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {/* Indicator */}
      <div
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          isSelected ? 'border-[#2E5E99] bg-[#2E5E99]' : 'border-muted-foreground/40 bg-white',
        )}
      >
        <RadioGroup.Indicator asChild>
          <div className="h-1.5 w-1.5 rounded-full bg-white" />
        </RadioGroup.Indicator>
      </div>

      {/* Icon */}
      {item.icon && (
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
            isSelected ? 'bg-[#2E5E99]/10 text-[#2E5E99]' : 'bg-muted text-muted-foreground',
          )}
        >
          {item.icon}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'text-sm font-semibold',
              isSelected ? 'text-[#2E5E99]' : 'text-foreground',
            )}
          >
            {item.label}
          </span>
          {item.badge && (
            <span className="rounded-md bg-[#2E5E99]/10 px-1.5 py-0.5 text-xs font-medium text-[#2E5E99]">
              {item.badge}
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
        )}
      </div>

      {/* Selected checkmark */}
      {isSelected && (
        <CheckCircle2
          size={16}
          className="absolute top-3 right-3 shrink-0 text-[#2E5E99]"
        />
      )}
    </RadioGroup.Item>
  );
}
