import { useConvexConnectionState, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { api } from "../convex/api";
import { usePersonalFoods } from "../data/personal-foods";
import { useI18n } from "../i18n";
import { colors, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { useConfirm } from "../ui/confirm-dialog";
import { SkeletonBlock, SkeletonGroup } from "../ui/skeleton";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { nutritionLibraryCopy } from "./nutrition-library-copy";

type ServerPage = {
	page: Parameters<
		ReturnType<typeof usePersonalFoods>["backup"]["receiveServerPage"]
	>[0];
	isDone: boolean;
	continueCursor: string;
};

function isServerPage(value: unknown): value is ServerPage {
	return (
		!!value && typeof value === "object" && "page" in value && "isDone" in value
	);
}

function conflictName(
	conflict: ReturnType<typeof usePersonalFoods>["backup"]["conflicts"][number],
	locale: "en" | "nl",
	copy: { unnamedFood: string; unnamedCombo: string },
) {
	const payload = conflict.localPayload ?? conflict.serverPayload;
	if (payload) {
		try {
			const parsed: unknown = JSON.parse(payload);
			if (parsed && typeof parsed === "object" && "name" in parsed) {
				const name = parsed.name;
				if (typeof name === "string" && name.trim()) return name;
				if (name && typeof name === "object" && locale in name) {
					const localized: unknown = Reflect.get(name, locale);
					if (typeof localized === "string" && localized.trim())
						return localized;
				}
			}
		} catch {
			// The service records the conflict even when an old payload is malformed.
		}
	}
	return conflict.record.kind === "food" ? copy.unnamedFood : copy.unnamedCombo;
}

export function NutritionLibraryScreen() {
	const { locale } = useI18n();
	const copy = nutritionLibraryCopy[locale];
	const foods = usePersonalFoods();
	const toast = useToast();
	const confirm = useConfirm();
	const resolveWithServer = foods.backup.useServerCopy;
	const [cursor, setCursor] = useState<string | null>(null);
	const [restoreVersion, setRestoreVersion] = useState(0);
	const received = useRef(new Set<string>());
	const { isWebSocketConnected } = useConvexConnectionState();
	const result = useQuery(
		api.nutritionLibrary.list,
		foods.backup.enabled
			? { paginationOpts: { cursor, numItems: 50 } }
			: "skip",
	);
	useEffect(() => {
		if (!isServerPage(result)) return;
		const key = `${restoreVersion}:${cursor ?? "first"}:${JSON.stringify(result.page.map((record) => [record.id, record.revision, record.deleted, record.payload]))}`;
		if (received.current.has(key)) return;
		try {
			foods.backup.receiveServerPage(result.page);
			received.current.add(key);
			if (!result.isDone) setCursor(result.continueCursor);
		} catch {
			toast.error(copy.failure);
		}
	}, [copy.failure, cursor, foods.backup, restoreVersion, result, toast]);
	const restore = () => {
		received.current.clear();
		setCursor(null);
		setRestoreVersion((version) => version + 1);
	};
	const retryUpload = () => {
		foods.backup.retry();
	};
	const keepDeviceCopy = (
		conflict: ReturnType<
			typeof usePersonalFoods
		>["backup"]["conflicts"][number],
	) => {
		try {
			foods.backup.keepDeviceCopy(conflict);
		} catch {
			toast.error(copy.failure);
		}
	};
	const applyServerCopy = async (
		conflict: ReturnType<
			typeof usePersonalFoods
		>["backup"]["conflicts"][number],
	) => {
		const name = conflictName(conflict, locale, copy);
		if (
			!(await confirm({
				title: copy.confirmServerTitle,
				message: copy.confirmServerBody(name),
				confirmLabel: copy.confirmServer,
				destructive: true,
			}))
		)
			return;
		try {
			resolveWithServer(conflict);
		} catch {
			toast.error(copy.failure);
		}
	};

	const enable = async () => {
		if (
			!(await confirm({
				title: copy.confirmEnableTitle,
				message: copy.confirmEnableBody,
				confirmLabel: copy.confirmEnable,
			}))
		)
			return;
		try {
			foods.backup.enable();
			toast.success(copy.ready);
		} catch {
			toast.error(copy.failure);
		}
	};
	const importLegacy = async () => {
		if (
			!(await confirm({
				title: copy.confirmImportTitle,
				message: copy.confirmImportBody,
				confirmLabel: copy.confirmImport,
			}))
		)
			return;
		try {
			foods.backup.importLegacy();
			toast.success(copy.imported);
		} catch {
			toast.error(copy.failure);
		}
	};

	if (foods.backup.enabled && result === undefined) {
		return (
			<ScrollView style={styles.root} contentContainerStyle={styles.content}>
				<SkeletonGroup label={copy.loading}>
					<SkeletonBlock height={80} />
					<SkeletonBlock height={180} />
				</SkeletonGroup>
				{!isWebSocketConnected ? (
					<Card style={styles.card}>
						<AppText>{copy.offline}</AppText>
						<GhostButton label={copy.restore} onPress={restore} />
					</Card>
				) : null}
			</ScrollView>
		);
	}
	return (
		<ScrollView style={styles.root} contentContainerStyle={styles.content}>
			<Eyebrow>{copy.eyebrow}</Eyebrow>
			<AppText variant="title">{copy.title}</AppText>
			<AppText>{copy.intro}</AppText>
			{!foods.backup.enabled ? (
				<Card style={styles.card}>
					<AppText>{copy.disabled}</AppText>
					<PrimaryButton label={copy.enable} onPress={() => void enable()} />
				</Card>
			) : (
				<>
					<Card style={styles.card}>
						<AppText variant="heading">{copy.import}</AppText>
						<AppText variant="caption">{copy.importHelp}</AppText>
						<PrimaryButton
							label={copy.import}
							onPress={() => void importLegacy()}
						/>
						<GhostButton label={copy.restore} onPress={restore} />
						<GhostButton label={copy.retryUpload} onPress={retryUpload} />
					</Card>
					{foods.backup.operations.length ? (
						<Card style={styles.card}>
							<AppText variant="heading">{copy.pending}</AppText>
							{foods.backup.operations.map((operation) => (
								<AppText key={operation.operationId} variant="caption">
									{operation.status}
									{operation.lastError ? ` · ${operation.lastError}` : ""}
								</AppText>
							))}
						</Card>
					) : null}
					{foods.backup.conflicts.length ? (
						<Card style={styles.card}>
							<AppText variant="heading">{copy.conflicts}</AppText>
							{foods.backup.conflicts.map((conflict) => {
								const name = conflictName(conflict, locale, copy);
								return (
									<View key={conflict.record.id} style={styles.conflict}>
										<AppText>{name}</AppText>
										<PrimaryButton
											label={copy.keep}
											onPress={() => keepDeviceCopy(conflict)}
										/>
										<GhostButton
											label={copy.server}
											onPress={() => void applyServerCopy(conflict)}
										/>
									</View>
								);
							})}
						</Card>
					) : null}
				</>
			)}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
	card: { gap: spacing.sm },
	conflict: {
		gap: spacing.sm,
		borderTopWidth: 1,
		borderTopColor: colors.border,
		paddingTop: spacing.sm,
	},
});
