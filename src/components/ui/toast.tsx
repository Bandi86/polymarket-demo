'use client'

import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

// Re-export toast functions for convenience
export const toast = {
  success: (title: string, description?: string) =>
    sonnerToast.success(title, { description }),
  error: (title: string, description?: string) =>
    sonnerToast.error(title, { description }),
  warning: (title: string, description?: string) =>
    sonnerToast.warning(title, { description }),
  info: (title: string, description?: string) =>
    sonnerToast.info(title, { description }),
  message: (title: string, description?: string) =>
    sonnerToast(title, { description }),
  promise: <T,>(promise: Promise<T>, messages: {
    loading: string;
    success: string;
    error: string;
  }) => sonnerToast.promise(promise, messages),
};

// Hook for components that prefer the hook pattern
export function useToastActions() {
  return toast;
}

// Toaster component - add this to your app root
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--glass-bg)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          borderRadius: "12px",
          padding: "12px 16px",
        },
        classNames: {
          success: "border-green-500/30",
          error: "border-red-500/30",
          warning: "border-amber-500/30",
          info: "border-blue-500/30",
        },
      }}
      expand={true}
      richColors
      closeButton
    />
  );
}