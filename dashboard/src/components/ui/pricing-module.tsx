'use client';
import React from 'react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Star, Zap } from 'lucide-react';

export interface PricingModuleFeature {
  text: string;
  highlighted?: boolean;
}

export interface PricingModulePlan {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number | null;
    yearly: number | null;
  };
  priceLabel?: string; // for "Custom"
  features: PricingModuleFeature[];
  cta: string;
  ctaHref?: string;
  badge?: string;
  highlighted?: boolean;
  icon?: React.ReactNode;
}

interface PricingModuleProps {
  plans: PricingModulePlan[];
  className?: string;
  onSelect?: (planId: string, billing: 'monthly' | 'yearly') => void;
}

export function PricingModule({ plans, className, onSelect }: PricingModuleProps) {
  const [yearly, setYearly] = React.useState(false);
  const billing: 'monthly' | 'yearly' = yearly ? 'yearly' : 'monthly';

  return (
    <div className={cn('w-full space-y-6', className)}>
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={cn('text-sm font-medium', !yearly ? 'text-foreground' : 'text-muted-foreground')}>
          Mensile
        </span>
        <Switch
          checked={yearly}
          onCheckedChange={setYearly}
          aria-label="Cambia fatturazione annuale"
        />
        <span className={cn('text-sm font-medium', yearly ? 'text-foreground' : 'text-muted-foreground')}>
          Annuale
        </span>
        {yearly && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            -12%
          </span>
        )}
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <PricingModuleCard
            key={plan.id}
            plan={plan}
            billing={billing}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

interface PricingModuleCardProps {
  plan: PricingModulePlan;
  billing: 'monthly' | 'yearly';
  onSelect?: (planId: string, billing: 'monthly' | 'yearly') => void;
}

function PricingModuleCard({ plan, billing, onSelect }: PricingModuleCardProps) {
  const price = plan.price[billing];
  const isCustom = price === null;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border transition-all duration-200',
        plan.highlighted
          ? 'border-[#2E5E99] bg-[#2E5E99] text-white shadow-xl shadow-[#2E5E99]/20 scale-[1.02]'
          : 'border-border bg-card hover:border-[#7BA4D0] hover:shadow-md',
      )}
    >
      {/* Badge */}
      {plan.badge && (
        <div
          className={cn(
            'absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
            plan.highlighted
              ? 'bg-white text-[#2E5E99]'
              : 'bg-[#2E5E99] text-white',
          )}
        >
          <Star size={11} className="fill-current" />
          {plan.badge}
        </div>
      )}

      {/* Header */}
      <div className={cn('p-5 pb-4', plan.highlighted ? '' : 'border-b')}>
        {plan.icon && (
          <div className={cn('mb-3 flex h-10 w-10 items-center justify-center rounded-xl',
            plan.highlighted ? 'bg-white/20' : 'bg-[#2E5E99]/10'
          )}>
            <span className={plan.highlighted ? 'text-white' : 'text-[#2E5E99]'}>
              {plan.icon}
            </span>
          </div>
        )}
        <div className={cn('text-base font-bold', plan.highlighted ? 'text-white' : 'text-[#0D2440]')}>
          {plan.name}
        </div>
        <p className={cn('mt-1 text-xs leading-relaxed', plan.highlighted ? 'text-white/80' : 'text-muted-foreground')}>
          {plan.description}
        </p>

        <div className="mt-4">
          {isCustom ? (
            <div className={cn('text-2xl font-bold', plan.highlighted ? 'text-white' : 'text-[#0D2440]')}>
              {plan.priceLabel ?? 'Custom'}
            </div>
          ) : (
            <div className="flex items-end gap-1">
              <span className={cn('text-3xl font-bold leading-none', plan.highlighted ? 'text-white' : 'text-[#0D2440]')}>
                €{price}
              </span>
              <span className={cn('mb-0.5 text-sm', plan.highlighted ? 'text-white/70' : 'text-muted-foreground')}>
                /mese
              </span>
            </div>
          )}
          {billing === 'yearly' && !isCustom && price !== null && (
            <p className={cn('mt-0.5 text-xs', plan.highlighted ? 'text-white/70' : 'text-muted-foreground')}>
              Fatturato €{Math.round(price * 12 * 0.88)}/anno
            </p>
          )}
        </div>
      </div>

      {/* Features */}
      <div className={cn('flex-1 space-y-2.5 px-5 py-4', plan.highlighted && 'border-t border-white/20')}>
        {plan.features.map((f, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <CheckCircle2
              size={15}
              className={cn('mt-0.5 shrink-0', plan.highlighted ? 'text-white/80' : 'text-[#2E5E99]')}
            />
            <span className={cn(
              f.highlighted ? 'font-semibold' : '',
              plan.highlighted ? 'text-white/90' : 'text-muted-foreground',
            )}>
              {f.text}
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="p-5 pt-3">
        <Button
          className={cn(
            'w-full font-semibold',
            plan.highlighted
              ? 'bg-white text-[#2E5E99] hover:bg-white/90'
              : '',
          )}
          variant={plan.highlighted ? 'default' : 'outline'}
          onClick={() => onSelect?.(plan.id, billing)}
          asChild={!!plan.ctaHref}
        >
          {plan.ctaHref ? (
            <a href={plan.ctaHref}>
              {plan.cta}
              <Zap size={14} className="ml-1.5" />
            </a>
          ) : (
            <span>
              {plan.cta}
              <Zap size={14} className="ml-1.5 inline" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
