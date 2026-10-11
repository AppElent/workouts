import { useConvexConnectionState, useQuery } from "convex/react";
import { useRef } from "react";
import { api } from "../../convex/api";
import { useI18n } from "../../i18n";
import { useConfirm } from "../../ui/confirm-dialog";
import { FormSection, TextAction } from "../../ui/form";
import { AppText } from "../../ui/text";
import { useTestDataReset } from "../local-data/account-data-maintenance-provider";

export function TestDataSection() {
	const status = useQuery(api.testData.availability, {});
	if (!status?.available) return null;
	return <TestDataActions blocker={status.blocker} />;
}

function TestDataActions({
	blocker,
}: {
	blocker: "activeActivity" | "hostedWorkout" | null;
}) {
	const online = useConvexConnectionState().isWebSocketConnected;
	const { t } = useI18n();
	const c = t.testData;
	const confirm = useConfirm();
	const reset = useTestDataReset();
	const pending = useRef(false);
	async function run(mode: "load" | "clear") {
		if (pending.current || !online || blocker) return;
		pending.current = true;
		try {
			if (
				await confirm({
					title: c[mode],
					message: `${mode === "load" ? c.loadConfirm : c.clearConfirm} ${c.preserved}`,
					confirmLabel: c[mode],
					cancelLabel: c.cancel,
					destructive: true,
				})
			)
				reset(mode);
		} finally {
			pending.current = false;
		}
	}
	return (
		<FormSection title={c.title} footer={c.description}>
			{blocker ? (
				<AppText>{c[blocker]}</AppText>
			) : !online ? (
				<AppText>{c.offline}</AppText>
			) : null}
			<TextAction
				label={c.load}
				disabled={!online || !!blocker}
				onPress={() => void run("load")}
			/>
			<TextAction
				label={c.clear}
				tone="destructive"
				disabled={!online || !!blocker}
				onPress={() => void run("clear")}
			/>
		</FormSection>
	);
}
