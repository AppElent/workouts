import type { CSSProperties } from "react";

/**
 * iOS stack header stand-in — glass material, minimal back chevron, toolbar action.
 */
export interface NavBarProps {
  title: string;
  /** Usually omitted: headerBackButtonDisplayMode is "minimal" (chevron only). */
  backLabel?: string;
  /** Pass to show the back chevron. */
  onBack?: () => void;
  /** Right-hand toolbar action — Stack.Toolbar.Button on iOS. */
  action?: { label: string; onPress?: () => void; disabled?: boolean };
  /** Large-title header for a tab root. */
  largeTitle?: boolean;
  /** Draws the mock status bar above the bar. */
  statusBar?: boolean;
  style?: CSSProperties;
}

export function NavBar(props: NavBarProps): JSX.Element;
