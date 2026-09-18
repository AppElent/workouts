import type { CSSProperties } from "react";

export interface ConfirmDialogProps {
  title: string;
  /** One line of consequence. Say what happens, not "Are you sure?". */
  message?: string;
  /** A verb: "Delete workout", "Cancel workout". Never "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button, and a warning haptic on the device. */
  destructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  style?: CSSProperties;
}

export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element;
