import { SymbolView } from "expo-symbols";
import { Pressable, View } from "react-native";
import { useI18n } from "../i18n";
import { type AppearancePreference, spacing, useAppearance } from "../theme";
import { FormScreen, FormSection } from "../ui/form";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

const choices: AppearancePreference[] = ["system", "light", "dark"];

export function AppearanceScreen() {
	const toast = useToast();
	const { t } = useI18n();
	const { preference, setPreference, colors } = useAppearance();
	return (
		<FormScreen>
			<FormSection footer={t.appearance.description}>
				{choices.map((choice) => (
					<Pressable
						key={choice}
						accessibilityRole="radio"
						accessibilityState={{ checked: preference === choice }}
						accessibilityLabel={t.appearance[choice]}
						onPress={() => {
							if (!setPreference(choice)) toast.error(t.appearance.saveError);
						}}
						style={({ pressed }) => ({
							minHeight: 52,
							padding: spacing.md,
							flexDirection: "row",
							alignItems: "center",
							gap: spacing.md,
							backgroundColor: pressed ? colors.surface2 : colors.surface,
						})}
					>
						<AppText style={{ flex: 1 }}>{t.appearance[choice]}</AppText>
						<View
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
						>
							{preference === choice ? (
								<SymbolView
									name={{ ios: "checkmark", android: "check", web: "check" }}
									size={20}
									tintColor={colors.accent}
								/>
							) : null}
						</View>
					</Pressable>
				))}
			</FormSection>
		</FormScreen>
	);
}
