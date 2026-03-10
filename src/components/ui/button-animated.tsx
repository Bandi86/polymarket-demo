import { forwardRef, type ButtonHTMLAttributes } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "ghost" | "success";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

const baseStyles = `
  inline-flex items-center justify-center gap-2 
  font-medium rounded-lg 
  transition-colors duration-200 
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2
  disabled:pointer-events-none disabled:opacity-50
  relative overflow-hidden
`;

const variantStyles = {
  default: `
    bg-[var(--color-primary)] text-white
    hover:bg-[var(--color-primary-hover)]
    shadow-lg shadow-primary/20
  `,
  destructive: `
    bg-[var(--color-destructive)] text-white
    hover:bg-red-600
    shadow-lg shadow-red-500/20
  `,
  outline: `
    border border-[var(--color-border)] bg-transparent
    text-[var(--color-text-primary)]
    hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-subtle)]
  `,
  ghost: `
    bg-transparent text-[var(--color-text-primary)]
    hover:bg-[var(--color-surface-hover)]
  `,
  success: `
    bg-[var(--color-success)] text-white
    hover:bg-emerald-600
    shadow-lg shadow-emerald-500/20
  `,
};

const sizeStyles = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "md", loading, children, disabled, ...props }, ref) => {
    const MotionButton = motion.button as React.FC<HTMLMotionProps<"button">>;
    
    return (
      <MotionButton
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        disabled={disabled || loading}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        {...(props as HTMLMotionProps<"button">)}
      >
        {loading && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-inherit rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        )}
        <span className={loading ? "opacity-0" : ""}>{children}</span>
        
        {/* Ripple effect container */}
        <span className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
          <span className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity duration-200" />
        </span>
      </MotionButton>
    );
  }
);

Button.displayName = "Button";