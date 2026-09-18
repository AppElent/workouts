import type { CSSProperties, ReactNode } from "react";

export interface GhostButtonProps {
  label: string;
  icon?: ReactNode;
  size?: "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** "destructive" paints the label in danger red; the border stays neutral. */
  tone?: "neutral" | "destructive";
  onClick?: () => void;
  style?: CSSProperties;
}

export function GhostButton(props: GhostButtonProps): JSX.Element;
