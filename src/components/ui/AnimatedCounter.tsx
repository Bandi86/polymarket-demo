'use client'

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
  value: number;
  previousValue?: number;
  format?: 'number' | 'currency' | 'percent';
  decimals?: number;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({
  value,
  previousValue,
  format = 'number',
  decimals = 2,
  duration = 500,
  className,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Determine if change is positive or negative
  const changeDirection = previousValue !== undefined
    ? value > previousValue ? 'up' : value < previousValue ? 'down' : null
    : null;

  useEffect(() => {
    if (previousValue === undefined || value === previousValue) {
      setDisplayValue(value);
      return;
    }

    const startValue = previousValue;
    const endValue = value;
    const difference = endValue - startValue;

    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + difference * easeOut;

      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    // Flash effect
    setFlash(changeDirection);
    const flashTimeout = setTimeout(() => setFlash(null), 500);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      clearTimeout(flashTimeout);
    };
  }, [value, previousValue, duration, changeDirection]);

  const formatValue = (num: number): string => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(num);
      case 'percent':
        return `${(num * 100).toFixed(1)}%`;
      default:
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(num);
    }
  };

  return (
    <span
      className={cn(
        'font-mono transition-colors duration-300',
        flash === 'up' && 'text-success',
        flash === 'down' && 'text-danger',
        className
      )}
    >
      {formatValue(displayValue)}
    </span>
  );
}