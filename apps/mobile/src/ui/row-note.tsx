import type { TextStyle } from "react-native";
import { useTokens } from "../theme";
import { AppText } from "./text";
import { useLargeText } from "./use-large-text";

/**
 * A row's note under its content: muted, two lines at most (all of it at
 * accessibility text sizes). Nothing when the note is empty, so a row without
 * one is unchanged.
 */
export function RowNote({ note, style }: { note: string; style?: TextStyle }) {
	const colors = useTokens();
	const large = useLargeText();
	return note ? (
		<AppText
			variant="footnote"
			numberOfLines={large ? undefined : 2}
			style={[{ color: colors.textMuted }, style]}
		>
			{note}
		</AppText>
	) : null;
}
