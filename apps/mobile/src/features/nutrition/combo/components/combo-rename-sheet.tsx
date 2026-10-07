import { useState } from "react";
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	modalAnimation,
	useReduceMotion,
} from "../../../../feedback/reduce-motion";
import { radius, spacing, type, useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";

/**
 * Keep the editable name visible above the keyboard until Save is acknowledged.
 */
export function ComboRenameSheet({
	visible,
	busy = false,
	title,
	name,
	label,
	cancelLabel,
	saveLabel,
	onCancel,
	onSave,
}: {
	visible: boolean;
	busy?: boolean;
	title: string;
	name: string;
	label: string;
	cancelLabel: string;
	saveLabel: string;
	onCancel: () => void;
	onSave: (name: string) => void;
}) {
	const colors = useTokens();
	const insets = useSafeAreaInsets();
	const reduceMotion = useReduceMotion();
	const [draft, setDraft] = useState(name);
	const valid = !busy && draft.trim().length > 0;
	return (
		<Modal
			visible={visible}
			transparent
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={onCancel}
			onShow={() => setDraft(name)}
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={{ flex: 1 }}
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
						paddingBottom: Math.max(insets.bottom, spacing.md),
						gap: spacing.md,
					}}
				>
					<AppText variant="navTitle" accessibilityRole="header">
						{title}
					</AppText>
					<TextInput
						autoFocus
						editable={!busy}
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
			</KeyboardAvoidingView>
		</Modal>
	);
}
