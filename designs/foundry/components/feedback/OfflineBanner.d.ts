import type { CSSProperties } from "react";

export interface OfflineBannerProps {
  /** Comes from the message tree — never hardcoded English in a Dutch app. */
  message?: string;
  style?: CSSProperties;
}

export function OfflineBanner(props: OfflineBannerProps): JSX.Element;
