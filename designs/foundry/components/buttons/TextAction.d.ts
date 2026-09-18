import type { CSSProperties } from "react";

export interface TextActionProps {
  label: string;
  tone?: "accent" | "neutral" | "destructive";
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function TextAction(props: TextActionProps): JSX.Element;
