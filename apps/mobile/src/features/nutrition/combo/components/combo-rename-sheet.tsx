import { useState } from "react";
import { Modal, Pressable, TextInput, View } from "react-native";
import { radius, spacing, type, useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";

/**
 * Renaming a combo where `Alert.prompt` does not exist (Android): a small
 * sheet with the name field, Cancel and Save. Save needs a name.
 */
export function ComboRenameSheet({
	visible,
	title,
	name,
	label,
	cancelLabel,
	saveLabel,
	onCancel,
	onSave,
}: {
	visible: boolean;
	title: string;
	name: string;
	label: string;
	cancelLabel: string;
	saveLabel: string;
	onCancel: () => void;
	onSave: (name: string) => void;
}) {
	const colors = useTokens();
	const [draft, setDraft] = useState(name);
	const valid = draft.trim().length > 0;
	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onCancel}
			onShow={() => setDraft(name)}
		>
			<Pressable
				accessibilityLabel={cancelLabel}
				onPress={onCancel}
				style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }}
			/>
			<View
				style={{
					backgroundColor: colors.surface,
					borderTopLeftRadius: radius.contentCard,
					borderTopRightRadius: radius.contentCard,
					padding: spacing.md,
					gap: spacing.md,
				}}
			>
				<AppText variant="navTitle" accessibilityRole="header">
					{title}
				</AppText>
				<TextInput
					autoFocus
					value={draft}
					onChangeText={setDraft}
					accessibilityLabel={label}
					returnKeyType="done"
					onSubmitEditing={() => valid && onSave(draft.trim())}
					style={{
						...type.control,
						color: colors.text,
						backgroundColor: colors.surface2,
						borderRadius: radius.md,
						paddingHorizontal: spacing.md,
						minHeight: 48,
					}}
				/>
				<View
					style={{
						flexDirection: "row",
						justifyContent: "flex-end",
						gap: spacing.md,
					}}
				>
					<Pressable
						accessibilityRole="button"
						onPress={onCancel}
						style={{ minHeight: 44, justifyContent: "center" }}
					>
						<AppText style={{ color: colors.text }}>{cancelLabel}</AppText>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ disabled: !valid }}
						disabled={!valid}
						onPress={() => onSave(draft.trim())}
						style={{
							minHeight: 44,
							justifyContent: "center",
							opacity: valid ? 1 : 0.4,
						}}
					>
						<AppText style={{ color: colors.accentInk, fontWeight: "700" }}>
							{saveLabel}
						</AppText>
					</Pressable>
				</View>
			</View>
		</Modal>
	);
}
