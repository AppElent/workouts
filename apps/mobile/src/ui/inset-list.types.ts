/**
 * The iOS inset grouped list — Foundry's `InsetList` / `InsetRow`
 * (`designs/foundry/components/data/InsetList.d.ts`), with the row actions
 * contract from `swipeable-row.tsx` folded in so a row's swipe, long-press
 * menu and VoiceOver actions are one prop rather than three components.
 *
 * Two implementations share these props: `inset-list.ios.tsx` draws a real
 * SwiftUI `List` (system corners, separators, swipe actions, context menu);
 * `inset-list.tsx` draws the same shape in React Native for Android and for
 * tests. Screens import `./inset-list` and never choose.
 */
import type { ImageProps } from "@expo/ui/swift-ui";
import type { ReactElement, ReactNode } from "react";
import type { SportKey } from "../theme";
import type { RowAction } from "./swipeable-row";

/** An SF Symbol name, typed the way `@expo/ui` types it (type-only import; erased). */
export type SFSymbol = NonNullable<ImageProps["systemName"]>;

/** What sits before the title. A sport tile, an SF Symbol, or anything RN. */
export type RowLeading =
	| { sport: SportKey; size?: number }
	| { symbol: SFSymbol }
	| ReactElement;

export interface InsetListProps {
	/** Section header above the group; the platform decides its case. */
	header?: string;
	/** One line of help under the group. */
	footer?: string;
	/** `InsetRow`s. Anything else is undefined behaviour on iOS. */
	children: ReactNode;
}

export interface InsetRowProps {
	/** Stable identity for the native list. */
	id?: string;
	leading?: RowLeading;
	title: string;
	secondary?: string;
	/** Trailing value, tabular — a duration, a weight, a count. */
	value?: string;
	/** Draws the disclosure chevron. Implied by nothing; say it. */
	chevron?: boolean;
	/** Red title for a destructive row such as "Sign out". */
	destructive?: boolean;
	onPress?: () => void;
	/**
	 * Reachable by swipe, by long press and as VoiceOver custom actions. The
	 * caller still owes a visible route to each of these somewhere.
	 */
	actions?: readonly RowAction[];
	/** Title of the long-press menu; defaults to the row title. */
	menuTitle?: string;
	/** Spoken name of the row; defaults to title + secondary. */
	accessibilityLabel?: string;
}
