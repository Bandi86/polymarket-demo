'use client'

import { type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

export interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  variant?: "default" | "elevated" | "glass";
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const variantStyles = {
  default: `
    bg-[var(--color-card)] 
    border border-[var(--color-border)]
  `,
  elevated: `
    bg-[var(--color-card)] 
    border border-[var(--color-border)]
    shadow-xl shadow-black/10
  `,
  glass: `
    bg-[var(--color-card)]/80
    backdrop-blur-xl
    border border-white/10
    shadow-xl shadow-black/5
  `,
};

const paddingStyles = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({
  children,
  variant = "default",
  hover = true,
  padding = "md",
  className = "",
  ...props
}: CardProps) {
  return (
    <motion.div
      className={`
        rounded-xl
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${className}
      `}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      whileHover={hover ? { y: -2, transition: { duration: 0.2 } } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return (
    <div className={`flex flex-col space-y-1.5 ${className}`}>
      {children}
    </div>
  );
}

export interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className = "" }: CardTitleProps) {
  return (
    <h3 className={`text-lg font-semibold leading-none tracking-tight text-[var(--color-text-primary)] ${className}`}>
      {children}
    </h3>
  );
}

export interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className = "" }: CardDescriptionProps) {
  return (
    <p className={`text-sm text-[var(--color-text-secondary)] ${className}`}>
      {children}
    </p>
  );
}

export interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = "" }: CardContentProps) {
  return <div className={`pt-4 ${className}`}>{children}</div>;
}

export interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return (
    <div className={`flex items-center pt-4 ${className}`}>
      {children}
    </div>
  );
}