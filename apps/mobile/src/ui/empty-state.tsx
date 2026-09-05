/**
 * What a region says when it holds nothing yet.
 *
 * An empty list is not a blank rectangle: it is a place where something can be
 * put, and the fastest way to explain that is to say so and offer the action.
 * The `action` is optional because some empty regions genuinely have no next
 * step of their own — a meal slot's plus control sits in its header, so the
 * slot only needs the sentence.
 */
import { StyleSheet, View } from "react-native";
import { spacing } from "../theme";
import { GhostButton } from "./button";
import { AppText } from "./text";

export function EmptyState({
	title,
	body,
	action,
}: {
	title?: string;
	body: string;
	action?: { label: string; onPress: () => void };
}) {
	return (
		<View style={styles.root}>
			{title ? <AppText variant="heading">{title}</AppText> : null}
			<AppText variant="caption">{body}</AppText>
			{action ? (
				<GhostButton
					label={action.label}
					onPress={action.onPress}
					style={styles.action}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { gap: spacing.sm },
	action: { alignSelf: "flex-start", marginTop: spacing.xs },
});
