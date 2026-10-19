"use client";

import { Toast } from "@base-ui/react/toast";
import { CheckCircle2, Info, X } from "lucide-react";
import type { ReactNode } from "react";

export const useAppToast = Toast.useToastManager;

export function AppToastProvider({ children }: { children: ReactNode }) {
  return <Toast.Provider timeout={2000} limit={1}>{children}<ToastNotifications/></Toast.Provider>;
}

function ToastNotifications() {
  const { toasts } = Toast.useToastManager();
  return <Toast.Portal><Toast.Viewport className="toast-viewport">
    {toasts.map(toast=><Toast.Root key={toast.id} toast={toast} className="app-toast" swipeDirection="down">
      {toast.type === "success" ? <CheckCircle2 size={20} aria-hidden="true"/> : <Info size={20} aria-hidden="true"/>}
      <Toast.Content className="toast-content"><Toast.Title className="toast-title"/></Toast.Content>
      <Toast.Close className="toast-close" aria-label="Đóng thông báo"><X size={16}/></Toast.Close>
    </Toast.Root>)}
  </Toast.Viewport></Toast.Portal>;
}
