import type { CSSProperties } from "react";

export interface AddRowProps {
  label: string;
  onPress?: () => void;
  style?: CSSProperties;
}

export function AddRow(props: AddRowProps): JSX.Element;
