import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
	type LocalRow,
	type LocalTable,
	listLocalDatabases,
	openLocalDatabaseInspector,
} from "../../data/local-database-inspector";
import { useI18n } from "../../i18n";
import { spacing } from "../../theme";
import {
	DisclosureRow,
	FormScreen,
	FormSection,
	TextAction,
} from "../../ui/form";
import { AppText } from "../../ui/text";
import { localDatabaseCopy } from "./local-database-copy";

type Inspector = ReturnType<typeof openLocalDatabaseInspector>;
type Page = ReturnType<Inspector["readPage"]>;

function readableRow(row: LocalRow) {
	return JSON.stringify(
		row,
		(_key, value) => {
			if (value instanceof Uint8Array) return `[${value.byteLength} bytes]`;
			if (typeof value === "string" && /^[{[]/.test(value)) {
				try {
					return JSON.parse(value);
				} catch {
					return value;
				}
			}
			return value;
		},
		2,
	);
}

export function LocalDatabaseScreen() {
	const { locale } = useI18n();
	const c = localDatabaseCopy[locale];
	return (
		<FormScreen>
			<Stack.Screen options={{ title: c.title }} />
			{__DEV__ ? <LocalDatabaseBrowser /> : <AppText>{c.unavailable}</AppText>}
		</FormScreen>
	);
}

function LocalDatabaseBrowser() {
	const { locale } = useI18n();
	const c = localDatabaseCopy[locale];
	const [revision, setRevision] = useState(0);
	const [databases, setDatabases] = useState<string[]>([]);
	const [database, setDatabase] = useState<string>();
	const [table, setTable] = useState<string>();
	const [page, setPage] = useState(0);
	const [expanded, setExpanded] = useState<number>();
	const [tables, setTables] = useState<LocalTable[]>([]);
	const [result, setResult] = useState<Page>();
	const [error, setError] = useState<string>();
	// biome-ignore lint/correctness/useExhaustiveDependencies: Refresh rereads mutable SQLite data without changing the selected page.
	useEffect(() => {
		setError(undefined);
		setResult(undefined);
		setTables([]);
		setExpanded(undefined);
		let inspector: Inspector | undefined;
		try {
			setDatabases(listLocalDatabases());
			if (database) {
				inspector = openLocalDatabaseInspector(database);
				setTables(inspector.listTables());
				if (table) setResult(inspector.readPage(table, page));
			}
		} catch (error) {
			setError(error instanceof Error ? error.message : String(error));
		} finally {
			inspector?.close();
		}
	}, [database, table, page, revision]);
	return (
		<>
			<AppText variant="footnote">{c.intro}</AppText>
			<TextAction
				label={c.refresh}
				onPress={() => setRevision((value) => value + 1)}
			/>
			{error ? <AppText selectable>{error}</AppText> : null}
			{database ? (
				<>
					<TextAction
						label={c.back}
						onPress={() => {
							setDatabase(undefined);
							setTable(undefined);
							setPage(0);
						}}
					/>
					<AppText selectable variant="caption">
						{database}
					</AppText>
				</>
			) : null}
			{!database ? (
				<FormSection>
					{databases.map((name) => (
						<DisclosureRow
							key={name}
							label={name}
							onPress={() => setDatabase(name)}
						/>
					))}
					{!databases.length && !error ? <AppText>{c.empty}</AppText> : null}
				</FormSection>
			) : null}
			{database && !table ? (
				<FormSection>
					{tables.map((item) => (
						<DisclosureRow
							key={item.name}
							label={item.name}
							value={c.rows(item.count)}
							onPress={() => {
								setTable(item.name);
								setPage(0);
							}}
						/>
					))}
				</FormSection>
			) : null}
			{table ? (
				<TextAction
					label={c.tables}
					onPress={() => {
						setTable(undefined);
						setPage(0);
					}}
				/>
			) : null}
			{result ? (
				<>
					<AppText selectable variant="heading">
						{result.name}
					</AppText>
					<AppText variant="caption">
						{c.rows(result.count)} · {c.page(page + 1, result.count)}
					</AppText>
					<AppText selectable variant="caption">
						{result.columns
							.map((column) => `${column.name} (${column.type})`)
							.join(" · ")}
					</AppText>
					<FormSection>
						{result.rows.map((row, index) => (
							<FormSection key={JSON.stringify(row)}>
								<DisclosureRow
									label={`${page * 25 + index + 1}. ${
										result.columns
											.filter((column) => column.pk)
											.map(
												(column) =>
													`${column.name}: ${String(row[column.name] ?? "NULL")}`,
											)
											.join(" · ") || String(Object.values(row)[0] ?? "NULL")
									}`}
									onPress={() =>
										setExpanded(expanded === index ? undefined : index)
									}
								/>
								{expanded === index ? (
									<AppText
										selectable
										variant="caption"
										style={{ padding: spacing.md }}
									>
										{readableRow(row)}
									</AppText>
								) : null}
							</FormSection>
						))}
					</FormSection>
					{!result.rows.length ? <AppText>{c.emptyTable}</AppText> : null}
					<TextAction
						label={c.previous}
						disabled={page === 0}
						onPress={() => setPage((value) => value - 1)}
					/>
					<TextAction
						label={c.next}
						disabled={(page + 1) * 25 >= result.count}
						onPress={() => setPage((value) => value + 1)}
					/>
				</>
			) : null}
		</>
	);
}
