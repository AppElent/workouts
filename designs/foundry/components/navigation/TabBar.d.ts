import type { CSSProperties, ReactNode } from "react";

export interface TabItem {
  key: string;
  label: string;
  /** SF Symbol name as passed to NativeTabs, e.g. "house.fill". */
  icon: string;
}

export interface TabBarProps {
  /** Five at most — UIKit collapses a sixth into a system "More" tab. */
  tabs: readonly TabItem[];
  value?: string;
  onChange?: (key: string) => void;
  /** iOS 26 bottom accessory — the ActiveSessionBar goes here. */
  accessory?: ReactNode;
  style?: CSSProperties;
}

export function TabBar(props: TabBarProps): JSX.Element;
