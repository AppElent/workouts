/**
 * How the screen tests mount the app.
 *
 * `renderRouter` can be pointed at the real `app/` directory, but it then loads
 * every route in the tree, which drags the chart library, the Convex client
 * and the whole session stack into a test about a meal slot. So the tests mount
 * a subset: the route modules listed below, loaded from `app/` by name so a
 * renamed or deleted route fails here, under the app's own data providers.
 *
 * The route *modules* are passed rather than their default exports, so a
 * route's `ErrorBoundary` is registered here exactly as expo-router registers
 * it in the app.
 */
import {
	useConvex,
	useMutation,
	usePaginatedQuery,
	useQuery,
} from "convex/react";
import { getFunctionName } from "convex/server";
import { Stack } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import type { ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { z } from "zod";
import { type AppDataOverrides, AppDataProviders } from "../app-data-providers";
import type { Id } from "../convex/api";
import {
	libraryRecordFromCombo,
	libraryRecordFromFood,
} from "../data/nutrition-library-repository";
import {
	createNutritionLocalRepository,
	type NutritionLocalRepository,
} from "../data/nutrition-local-repository";
import type { FetchLike } from "../data/open-food-facts";
import {
	createOpenFoodFactsCache,
	createPersonalFoodRepository,
	type PersonalFoodRepository,
} from "../data/personal-food-repository";
import { RestTimerProvider } from "../features/strength-session/components/rest-timer";
import { LocaleProvider } from "../i18n";
import { AppearanceProvider } from "../theme";
import { ConfirmProvider } from "../ui/confirm-dialog";
import { ToastProvider } from "../ui/toast";
import { installAccountTransport } from "./account-transport";
import {
	type CaptureDraftFixture,
	createCaptureDraftFixture,
} from "./capture-draft-fixture";
import { NativeAlertHost } from "./native-alert-host";
import { SQLiteTestDatabase } from "./sqlite-test-database";

jest.mock("../features/nutrition/day-goals/components/goal-row-menu", () =>
	jest.requireActual(
		"../features/nutrition/day-goals/components/goal-row-menu.tsx",
	),
);
// Exercise the public RN row contract here; native adapter wiring has dedicated tests and simulator acceptance.
jest.mock("../ui/inset-list", () => jest.requireActual("../ui/inset-list.tsx"));

type NutritionLibraryOperationEnvelope = import("convex/server").FunctionArgs<
	typeof import("../convex/api").api.nutritionLibrary.save
>;

const photoStorageId = z.custom<Id<"_storage">>(
	(value) => typeof value === "string",
);

/** Routes of the `(app)` stack that screen tests can reach. */
const APP_ROUTES = [
	"appearance",
	"labs",
	"labs-entry",
	"labs-food",
	"language",
	"nutrition-assistance",
	"nutrition-combo-log",
	"nutrition-combo-new",
	"nutrition-combo-part",
	"nutrition-combo/[id]",
	"nutrition-day-goals",
	"nutrition-entry",
	"nutrition-entry-correction",
	"nutrition-entry-transfer",
	"nutrition-food",
	"nutrition-food-details",
	"nutrition-goals",
	"nutrition-library",
	"nutrition-library-attention",
	"nutrition-nutrient-sources",
	"nutrition-one-off",
	"nutrition-week-goals",
	"nutrition-week-sources",
	"nutrition-weekly-review",
	"personal-food-new",
	"personal-food/[id]",
	"personal-measures",
] as const;
/** Tabs of the `(coach)` group, mounted at the root like the app's tab URLs. */
const TAB_ROUTES = ["nutrition", "profile"] as const;

function routeModules(): Record<string, unknown> {
	return Object.fromEntries([
		...APP_ROUTES.map((name) => [
			name,
			jest.requireActual(`../../app/(app)/${name}`),
		]),
		...TAB_ROUTES.map((name) => [
			name,
			jest.requireActual(`../../app/(app)/(coach)/${name}`),
		]),
	]);
}

/** Screen tests acknowledge the library transport at its public Convex boundary. */
function installLibraryTransport(repository: PersonalFoodRepository) {
	const mutation = jest.mocked(useMutation).getMockImplementation();
	const query = jest.mocked(useQuery).getMockImplementation();
	const paginated = jest.mocked(usePaginatedQuery).getMockImplementation();
	const servePayload = (payload: string) => {
		const food = JSON.parse(payload);
		if (food.visual?.storageId)
			return JSON.stringify({
				...food,
				visual: { ...food.visual, uri: "https://fixture.invalid/photo.jpg" },
			});
		return payload;
	};
	const save = jest.fn(async (args: NutritionLibraryOperationEnvelope) => ({
		record:
			args.operation.kind === "upsert"
				? {
						...args.operation.record,
						payload: servePayload(args.operation.record.payload),
						revision: 1,
						deleted: false,
					}
				: {
						id: args.operation.recordId,
						kind: args.operation.recordKind,
						payload: null,
						revision: 2,
						deleted: true,
					},
	}));
	const records = () => [
		...repository.list().map((food) => ({
			...libraryRecordFromFood(food, 1),
			payload: servePayload(libraryRecordFromFood(food, 1).payload ?? "{}"),
			subject: "test-user",
		})),
		...repository.listCombos().map((combo) => ({
			...libraryRecordFromCombo(combo, 1),
			subject: "test-user",
		})),
	];
	jest.mocked(useConvex).mockReturnValue({
		query: jest.fn(async (_ref, args) =>
			records().filter(
				(record) =>
					args.ids?.includes(record.id) ||
					args.forkIds?.includes(
						repository.find(record.id)?.provenance.forkedFrom,
					) ||
					(args.barcode &&
						repository.find(record.id)?.provenance.barcode === args.barcode),
			),
		),
	} as never);
	jest
		.mocked(useMutation)
		.mockImplementation(((reference: never) =>
			getFunctionName(reference) === "nutritionLibrary:save"
				? save
				: mutation?.(reference)) as never);
	jest.mocked(useQuery).mockImplementation(((
		reference: never,
		args: { ids?: string[]; barcode?: string } | "skip",
	) => {
		if (getFunctionName(reference) !== "nutritionLibrary:getMany")
			return query?.(reference, args as never);
		return args === "skip"
			? undefined
			: records().filter(
					(record) =>
						args.ids?.includes(record.id) ||
						(args.barcode &&
							record.kind === "food" &&
							repository.find(record.id)?.provenance.barcode === args.barcode),
				);
	}) as never);
	jest.mocked(usePaginatedQuery).mockImplementation(((
		reference: never,
		args: { query?: string; category?: string } | "skip",
		options: never,
	) => {
		if (getFunctionName(reference) !== "nutritionLibrary:browse")
			return paginated?.(reference, args as never, options);
		const selected =
			args === "skip"
				? []
				: records().filter((record) => {
						const parsed = JSON.parse(record.payload ?? "null");
						const name =
							record.kind === "food"
								? `${parsed.name.en} ${parsed.name.nl}`
								: parsed.name;
						const category =
							record.kind === "combo"
								? "combo"
								: parsed.classification === "recipe"
									? "recipe"
									: "food";
						return (
							(!args.query ||
								name.toLowerCase().includes(args.query.toLowerCase())) &&
							(!args.category || category === args.category)
						);
					});
		return {
			results: selected,
			status: "Exhausted",
			loadMore: jest.fn(),
			isLoading: false,
		};
	}) as never);
}
export function TestLayout({
	overrides,
}: {
	overrides: AppDataOverrides;
}): ReactNode {
	return (
		<GestureHandlerRootView>
			<AppearanceProvider>
				<LocaleProvider>
					<NativeAlertHost>
						<ToastProvider>
							<ConfirmProvider>
								<RestTimerProvider>
									<AppDataProviders overrides={overrides}>
										<Stack />
									</AppDataProviders>
								</RestTimerProvider>
							</ConfirmProvider>
						</ToastProvider>
					</NativeAlertHost>
				</LocaleProvider>
			</AppearanceProvider>
		</GestureHandlerRootView>
	);
}

export async function renderApp(
	initialUrl = "/nutrition",
	/** Replace a route module — used to make a route throw on purpose. */
	overrides: Record<string, unknown> = {},
	/** A fake fetch for tests that exercise the Open Food Facts network boundary. */
	fetchImpl?: FetchLike,
	seed?: (stores: {
		draftRepository: CaptureDraftFixture;
		nutritionRepository: NutritionLocalRepository;
		personalFoods: ReturnType<typeof createPersonalFoodRepository>;
	}) => void,
) {
	const repository = createPersonalFoodRepository(new SQLiteTestDatabase());
	const offCache = createOpenFoodFactsCache(new SQLiteTestDatabase());
	const nutritionRepository = createNutritionLocalRepository(
		new SQLiteTestDatabase(),
	);
	const draftRepository = createCaptureDraftFixture();
	seed?.({ draftRepository, nutritionRepository, personalFoods: repository });
	installLibraryTransport(repository);
	const accountTransport = installAccountTransport(draftRepository);
	const data: AppDataOverrides = {
		personalFoods: repository,
		nutrition: nutritionRepository,
		openFoodFactsCache: offCache,
		fetchImpl,
		uploadPhoto: async () => ({
			storageId: photoStorageId.parse("fixture-photo"),
		}),
		subject: "test-user",
	};
	function Layout() {
		return <TestLayout overrides={data} />;
	}
	const rendered = await renderRouter(
		{
			_layout: Layout as never,
			...(routeModules() as Record<string, never>),
			...(overrides as Record<string, never>),
		},
		{ initialUrl },
	);
	return Object.assign(rendered, {
		repository,
		offCache,
		nutritionRepository,
		draftRepository,
		accountTransport,
	});
}
