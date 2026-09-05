/**
 * The mid-session "add an exercise" picker, ported from the web's
 * `src/components/session/AddExerciseModal.tsx`.
 *
 * Deliberately not the exercise library screen. Mid-set, one-handed, the only
 * questions are "which exercise" and "get out of my way" — so this is a search
 * box and a list, with none of the library's filters, cards, or detail links.
 *
 * Picking an exercise does not write anything. It becomes real on the first
 * logged set, which is also what lets you back out of a mis-tap for free.
 */
import { useMemo, useState } from "react";
import {
	FlatList,
	Modal,
	Pressable,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Doc, Id } from "../convex/api";
import { colors, radius, spacing } from "../theme";
import { AppText } from "../ui/text";

export function AddExercisePicker({
	visible,
	exercises,
	onSelect,
	onClose,
}: {
	visible: boolean;
	/** `undefined` while the catalog query is in flight. */
	exercises: Doc<"exercises">[] | undefined;
	onSelect: (id: Id<"exercises">) => void;
	onClose: () => void;
}) {
	const [search, setSearch] = useState("");
	const insets = useSafeAreaInsets();

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		const all = exercises ?? [];
		if (term === "") return all;
		return all.filter((e) => e.name.toLowerCase().includes(term));
	}, [exercises, search]);

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent={false}
			onRequestClose={onClose}
		>
			<View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
				<View style={styles.header}>
					<AppText variant="heading">Add exercise</AppText>
					<Pressable
						onPress={onClose}
						hitSlop={12}
						accessibilityRole="button"
						accessibilityLabel="Close"
					>
						<AppText variant="body" style={styles.close}>
							Done
						</AppText>
					</Pressable>
				</View>

				<TextInput
					value={search}
					onChangeText={setSearch}
					placeholder="Search exercises"
					placeholderTextColor={colors.textFaint}
					style={styles.input}
					autoCorrect={false}
					autoFocus
					returnKeyType="search"
				/>

				{exercises === undefined ? (
					<AppText variant="caption" style={styles.pad}>
						Loading…
					</AppText>
				) : (
					<FlatList
						data={filtered}
						keyExtractor={(item) => item._id}
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={styles.list}
						ListEmptyComponent={
							<AppText variant="caption" style={styles.pad}>
								No exercises match "{search.trim()}".
							</AppText>
						}
						renderItem={({ item }) => (
							<Pressable
								onPress={() => onSelect(item._id)}
								style={({ pressed }) => [
									styles.row,
									pressed && { backgroundColor: colors.surface2 },
								]}
							>
								<View style={styles.flex}>
									<AppText variant="body" style={styles.name}>
										{item.name}
									</AppText>
									<AppText variant="caption">
										{item.equipment} · {item.category}
									</AppText>
								</View>
							</Pressable>
						)}
					/>
				)}
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		minHeight: 44,
	},
	close: { color: colors.accent, fontWeight: "800" },
	input: {
		minHeight: 48,
		marginVertical: spacing.sm,
		borderRadius: radius.lg,
		paddingHorizontal: spacing.md,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		color: colors.text,
		fontSize: 15,
	},
	list: { gap: spacing.xs, paddingBottom: spacing.xl },
	pad: { padding: spacing.md },
	row: {
		flexDirection: "row",
		alignItems: "center",
		minHeight: 56,
		paddingHorizontal: spacing.md,
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
	},
	flex: { flex: 1, gap: 2 },
	name: { fontWeight: "700" },
});
