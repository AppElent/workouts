import type { CSSProperties, ReactNode } from "react";

export interface RowAction {
  /** Stable key; also the accessibility action name. */
  key: string;
  label: string;
  onPress?: () => void;
  /** Danger colour and destructive role. Never skips confirmation. */
  destructive?: boolean;
  /** false keeps a secondary action in the menu only. */
  swipe?: boolean;
}

/**
 * List row with revealed actions, a long-press menu and screen-reader actions.
 */
export interface SwipeableRowProps {
  actions: readonly RowAction[];
  /** Names the object being acted on, so the menu is not four verbs with no subject. */
  menuTitle: string;
  /** Mock/controlled reveal state. */
  open?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
  style?: CSSProperties;
}

export function SwipeableRow(props: SwipeableRowProps): JSX.Element;
