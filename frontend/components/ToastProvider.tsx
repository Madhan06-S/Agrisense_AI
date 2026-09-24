"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

interface Toast {
  id: string;
  message: string;
  type: "error" | "success" | "info";
}

interface ToastContextType {
  showToast: (message: string, type?: "error" | "success" | "info") => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: "error" | "success" | "info" = "error") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const handleApiError = (event: CustomEvent<{ message: string }>) => {
      if (event.detail?.message) {
        showToast(event.detail.message, "error");
      }
    };

    window.addEventListener("api-error" as any, handleApiError as any);
    return () => {
      window.removeEventListener("api-error" as any, handleApiError as any);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5 ${
              toast.type === "error"
                ? "bg-red-50/95 border-red-200 text-red-900"
                : toast.type === "success"
                ? "bg-green-50/95 border-green-200 text-green-900"
                : "bg-blue-50/95 border-blue-200 text-blue-900"
            }`}
          >
            <div className="flex items-start gap-2.5">
              {toast.type === "error" && <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
              {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />}
              {toast.type === "info" && <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
              <div className="text-xs font-semibold leading-relaxed">{toast.message}</div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function dispatchApiError(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("api-error", { detail: { message } })
    );
  }
}
