import type { CSSProperties, ReactNode } from "react";

/** Photo card for one object — today's workout, a routine, a progress photo. */
export interface HeroCardProps {
  src?: string;
  alt?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Third line, fainter — "8 exercises · 45 min". */
  meta?: string;
  /** Lay the copy over the image with a protection gradient. Controlled imagery only. */
  overlay?: boolean;
  /** CSS aspect-ratio for the image well. 16/9 default, 4/3 for progress photos. */
  ratio?: string;
  /** Usually a PrimaryButton. */
  action?: ReactNode;
  onPress?: () => void;
  style?: CSSProperties;
}

export function HeroCard(props: HeroCardProps): JSX.Element;
