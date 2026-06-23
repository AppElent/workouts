import { api } from "@convex/_generated/api";
import { useConvex } from "convex/react";
import { format } from "date-fns";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { useState } from "react";

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

function csvCell(value: unknown): string {
	const s = value === undefined || value === null ? "" : String(value);
	return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type ExportPayload = (typeof api.exportData.allData)["_returnType"];

function setsToCsv(data: ExportPayload): string {
	const exerciseName = new Map(data.exercises.map((e) => [e._id, e.name]));
	const sessionName = new Map(
		data.sessions.map((s) => [
			s._id as string,
			s.name ?? format(new Date(s.date), "yyyy-MM-dd"),
		]),
	);
	const header = [
		"date",
		"session",
		"exercise",
		"setNumber",
		"setType",
		"weight",
		"unit",
		"reps",
		"rpe",
	];
	const rows = [...data.sets]
		.sort((a, b) => a.loggedAt - b.loggedAt)
		.map((s) =>
			[
				format(new Date(s.loggedAt), "yyyy-MM-dd HH:mm"),
				sessionName.get(s.sessionId as string) ?? "",
				exerciseName.get(s.exerciseId as string) ?? "",
				s.setNumber,
				s.setType,
				s.weight,
				s.unit,
				s.reps,
				s.rpe ?? "",
			]
				.map(csvCell)
				.join(","),
		);
	return [header.join(","), ...rows].join("\n");
}

export function ExportDataCard() {
	const convex = useConvex();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function run(kind: "json" | "csv") {
		setBusy(true);
		setError(null);
		try {
			const data = await convex.query(api.exportData.allData, {});
			const stamp = format(new Date(), "yyyy-MM-dd");
			if (kind === "json") {
				download(
					`workouts-export-${stamp}.json`,
					JSON.stringify(data, null, 2),
					"application/json",
				);
			} else {
				download(
					`workouts-sets-${stamp}.csv`,
					setsToCsv(data),
					"text/csv;charset=utf-8",
				);
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Export failed.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 sm:p-5">
			<div className="flex items-center gap-2 mb-1">
				<Download size={16} className="text-[var(--accent)]" />
				<h2 className="text-sm font-semibold text-white">Export your data</h2>
			</div>
			<p className="text-xs text-[var(--text-muted)] mb-4">
				Download a full backup as JSON, or your set history as a spreadsheet.
			</p>
			<div className="flex flex-col sm:flex-row gap-2">
				<button
					type="button"
					onClick={() => void run("csv")}
					disabled={busy}
					className="flex-1 h-11 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm font-semibold text-white flex items-center justify-center gap-2 hover:border-[var(--accent)]/40 transition-colors disabled:opacity-40"
				>
					<FileSpreadsheet size={15} />
					Sets CSV
				</button>
				<button
					type="button"
					onClick={() => void run("json")}
					disabled={busy}
					className="flex-1 h-11 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm font-semibold text-white flex items-center justify-center gap-2 hover:border-[var(--accent)]/40 transition-colors disabled:opacity-40"
				>
					<FileJson size={15} />
					Full JSON
				</button>
			</div>
			{error && <p className="text-xs text-[var(--danger)] mt-3">{error}</p>}
		</div>
	);
}
