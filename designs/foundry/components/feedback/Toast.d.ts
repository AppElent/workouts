import type { CSSProperties } from "react";

export interface ToastProps {
  kind?: "error" | "success";
  message: string;
  /** Tap dismisses; the app also auto-dismisses after 4000ms. */
  onDismiss?: () => void;
  style?: CSSProperties;
}

export function Toast(props: ToastProps): JSX.Element;
