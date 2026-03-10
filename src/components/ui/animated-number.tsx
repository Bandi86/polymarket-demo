import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
}

export function AnimatedNumber({
  value,
  decimals = 2,
  prefix = "",
  suffix = "",
  className = "",
  duration = 0.3,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      setDirection(value > prevValue.current ? "up" : "down");
      prevValue.current = value;
      
      // Animate number change
      const startValue = displayValue;
      const endValue = value;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / (duration * 1000), 1);
        
        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        
        const current = startValue + (endValue - startValue) * easeOutQuart;
        setDisplayValue(current);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
      
      // Clear direction after animation
      setTimeout(() => setDirection(null), duration * 1000 + 100);
    }
  }, [value, duration, displayValue]);

  const formattedValue = displayValue.toFixed(decimals);
  const [intPart, decPart] = formattedValue.split(".");

  return (
    <span className={`inline-flex items-center ${className}`}>
      {prefix && <span className="mr-0.5">{prefix}</span>}
      <span className="relative">
        <AnimatePresence>
          {direction && (
            <motion.span
              className={`absolute inset-0 rounded ${direction === "up" ? "bg-emerald-500/20" : "bg-red-500/20"}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </AnimatePresence>
        <motion.span
          key={Math.floor(value)}
          initial={{ y: direction === "up" ? -5 : direction === "down" ? 5 : 0, opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="tabular-nums"
        >
          {intPart}
          {decPart !== undefined && (
            <span className="text-[var(--color-text-secondary)]">.{decPart}</span>
          )}
        </motion.span>
      </span>
      {suffix && <span className="ml-0.5">{suffix}</span>}
    </span>
  );
}

// Price ticker with up/down indicator
interface PriceTickerProps {
  price: number;
  previousPrice?: number;
  decimals?: number;
  prefix?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PriceTicker({
  price,
  previousPrice,
  decimals = 2,
  prefix = "$",
  size = "md",
  className = "",
}: PriceTickerProps) {
  const [flashDirection, setFlashDirection] = useState<"up" | "down" | null>(null);
  const prevPrice = useRef(price);

  useEffect(() => {
    if (previousPrice !== undefined && price !== previousPrice) {
      setFlashDirection(price > previousPrice ? "up" : "down");
      setTimeout(() => setFlashDirection(null), 500);
    } else if (price !== prevPrice.current) {
      setFlashDirection(price > prevPrice.current ? "up" : "down");
      setTimeout(() => setFlashDirection(null), 500);
    }
    prevPrice.current = price;
  }, [price, previousPrice]);

  const sizeStyles = {
    sm: "text-sm",
    md: "text-lg font-semibold",
    lg: "text-2xl font-bold",
  };

  return (
    <motion.span
      className={`inline-flex items-center gap-1 ${sizeStyles[size]} ${className}`}
      animate={{
        color: flashDirection === "up" 
          ? "var(--color-success)" 
          : flashDirection === "down" 
          ? "var(--color-danger)" 
          : "var(--color-text-primary)",
      }}
      transition={{ duration: 0.2 }}
    >
      <AnimatedNumber
        value={price}
        decimals={decimals}
        prefix={prefix}
      />
      {flashDirection && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className={`text-xs ${flashDirection === "up" ? "text-emerald-400" : "text-red-400"}`}
        >
          {flashDirection === "up" ? "↑" : "↓"}
        </motion.span>
      )}
    </motion.span>
  );
}

// Percentage change with color
interface PercentChangeProps {
  value: number;
  decimals?: number;
  showSign?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PercentChange({
  value,
  decimals = 2,
  showSign = true,
  size = "sm",
  className = "",
}: PercentChangeProps) {
  const isPositive = value >= 0;
  const formattedValue = Math.abs(value).toFixed(decimals);

  const sizeStyles = {
    sm: "text-xs",
    md: "text-sm font-medium",
    lg: "text-base font-semibold",
  };

  return (
    <motion.span
      className={`inline-flex items-center gap-0.5 ${sizeStyles[size]} ${
        isPositive ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
      } ${className}`}
      initial={{ scale: 0.95 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <span>{isPositive ? "+" : "-"}</span>
      <span>{formattedValue}%</span>
    </motion.span>
  );
}