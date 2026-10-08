import { Stack, useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet } from "react-native";
import { useI18n } from "../../i18n";
import { spacing } from "../../theme";
import { SportIcon } from "../../ui/coach";
import {
	FormChoiceRow,
	FormScreen,
	FormSection,
	FormTextField,
} from "../../ui/form";
import { AppText } from "../../ui/text";
import { useStartActivity } from "./start-activity-flow";

export function StartActivityScreen() {
	const router = useRouter();
	const {
		t: { training: copy },
	} = useI18n();
	const flow = useStartActivity();
	const { data, pending, sport, routineId, name } = flow;
	const primaryLabel = pending
		? copy.starting
		: sport === "strength"
			? copy.start
			: copy.continue;
	const submit = () => void flow.submit();
	return (
		<>
			<Stack.Screen
				options={{
					title: copy.startActivity,
					gestureEnabled: !pending,
					...(Platform.OS === "android"
						? {
								headerLeft: () => (
									<Pressable
										accessibilityRole="button"
										disabled={pending}
										onPress={() => router.back()}
									>
										<AppText>{copy.close}</AppText>
									</Pressable>
								),
								headerRight: () => (
									<Pressable
										accessibilityRole="button"
										disabled={pending}
										onPress={submit}
									>
										<AppText>{primaryLabel}</AppText>
									</Pressable>
								),
							}
						: {}),
				}}
			/>
			{Platform.OS === "ios" && (
				<>
					<Stack.Toolbar placement="left">
						<Stack.Toolbar.Button
							icon="xmark"
							accessibilityLabel={copy.close}
							disabled={pending}
							onPress={() => router.back()}
						/>
					</Stack.Toolbar>
					<Stack.Toolbar placement="right">
						<Stack.Toolbar.Button disabled={pending} onPress={submit}>
							{primaryLabel}
						</Stack.Toolbar.Button>
					</Stack.Toolbar>
				</>
			)}
			<FormScreen nativeSheet>
				<FormSection title={copy.activity}>
					{(["strength", "running", "cycling", "wod"] as const).map((value) => (
						<FormChoiceRow
							key={value}
							role="radio"
							label={copy[value]}
							selected={sport === value}
							disabled={pending}
							leading={<SportIcon sport={value} size={30} />}
							onPress={() => flow.setSport(value)}
						/>
					))}
				</FormSection>
				{sport === "strength" ? (
					<>
						<FormSection>
							<FormChoiceRow
								role="radio"
								label={copy.emptySession}
								secondary={copy.emptySessionHint}
								selected={routineId === null}
								disabled={pending}
								onPress={() => flow.setRoutineId(null)}
							/>
						</FormSection>
						<FormSection title={copy.routines} footer={copy.routineHint}>
							{data.routines?.map((routine) => (
								<FormChoiceRow
									key={routine._id}
									role="radio"
									label={routine.name}
									secondary={`${routine.exercises.length} ${routine.exercises.length === 1 ? copy.singleExercise : copy.exerciseCount} · ${routine.exercises.reduce((sum, e) => sum + e.defaultSets, 0)} ${copy.setCount}`}
									selected={routineId === routine._id}
									disabled={pending}
									onPress={() => flow.setRoutineId(routine._id)}
								/>
							))}
							{data.routines === undefined && (
								<AppText style={styles.message}>
									{!data.online
										? copy.coldOffline
										: data.error
											? copy.loadError
											: copy.loading}
								</AppText>
							)}
							{data.routines?.length === 0 && (
								<AppText style={styles.message}>{copy.empty}</AppText>
							)}
							{data.error && (
								<Pressable
									style={styles.message}
									accessibilityRole="button"
									onPress={data.retry}
								>
									<AppText>{copy.retry}</AppText>
								</Pressable>
							)}
						</FormSection>
						{routineId === null && (
							<FormSection>
								<FormTextField
									label={copy.sessionName}
									placeholder={copy.optionalName}
									value={name}
									onChangeText={flow.setName}
									editable={!pending}
									maxLength={120}
									returnKeyType="go"
									onSubmitEditing={submit}
								/>
							</FormSection>
						)}
					</>
				) : (
					<AppText variant="footnote">
						{sport === "wod" ? copy.wodPickerHint : copy.enduranceHint}
					</AppText>
				)}
				{!data.online && <AppText variant="footnote">{copy.offline}</AppText>}
			</FormScreen>
		</>
	);
}

const styles = StyleSheet.create({ message: { padding: spacing.md } });
