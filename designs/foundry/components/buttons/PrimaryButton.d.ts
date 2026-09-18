import type { CSSProperties, ReactNode } from "react";

/**
 * The screen's single primary action.
 */
export interface PrimaryButtonProps {
  label: string;
  /** Rendered left of the label — an Icon, usually. */
  icon?: ReactNode;
  size?: "md" | "lg";
  /** Shows a pending state and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
  /** Defaults to true: primary actions stretch in a safe-area footer. */
  fullWidth?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function PrimaryButton(props: PrimaryButtonProps): JSX.Element;
