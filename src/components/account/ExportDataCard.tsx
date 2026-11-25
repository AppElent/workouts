import { api } from "@convex/_generated/api";
import { accountExportJson, collectExportTables } from "@foundry/core";
import { useConvex } from "convex/react";
import { format } from "date-fns";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { useConvexErrorMessage } from "#/lib/convexError";
import { useExercises } from "#/lib/exercises";
import { useI18n } from "#/lib/i18n";
import { setsToCsv } from "./setsCsv";

function download(filename: string, content: string, type: string) {
	const blob = new Blob([content], { type });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

type Kind = "json" | "csv";

export function ExportDataCard() {
	const convex = useConvex();
	const exercises = useExercises();
	const errorMessage = useConvexErrorMessage();
	const {
		messages: {
			account: { export: c },
		},
	} = useI18n();
	const [busy, setBusy] = useState<Kind | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function run(kind: Kind) {
		setBusy(kind);
		setError(null);
		try {
			const tables = await collectExportTables((cursor) =>
				convex.query(api.exportData.personalPage, { cursor }),
			);
			const stamp = format(new Date(), "yyyy-MM-dd");
			if (kind === "json") {
				download(
					`foundry-export-${stamp}.json`,
					accountExportJson(tables, new Date()),
					"application/json",
				);
			} else {
				download(
					`foundry-sets-${stamp}.csv`,
					setsToCsv(tables, exercises),
					"text/csv;charset=utf-8",
				);
			}
		} catch (e) {
			setError(errorMessage(e, c.error));
		} finally {
			setBusy(null);
		}
	}

	return (
		<div className="rounded-xl bg-surface border border-border p-4 sm:p-5">
			<div className="flex items-center gap-2 mb-1">
				<Download size={16} className="text-accent-ink" />
				<h2 className="text-sm font-semibold text-text">{c.title}</h2>
			</div>
			<p className="text-xs text-text-muted mb-4">{c.footer}</p>
			<div className="flex flex-col sm:flex-row gap-2">
				<Button
					variant="outline"
					className="flex-1 h-11 font-semibold"
					onClick={() => void run("csv")}
					disabled={busy !== null}
					loading={busy === "csv"}
				>
					{busy !== "csv" && <FileSpreadsheet aria-hidden="true" />}
					{c.setsCsv}
				</Button>
				<Button
					variant="outline"
					className="flex-1 h-11 font-semibold"
					onClick={() => void run("json")}
					disabled={busy !== null}
					loading={busy === "json"}
				>
					{busy !== "json" && <FileJson aria-hidden="true" />}
					{c.fullJson}
				</Button>
			</div>
			{error && (
				<p role="alert" className="text-xs text-danger mt-3">
					{error}
				</p>
			)}
		</div>
	);
}
