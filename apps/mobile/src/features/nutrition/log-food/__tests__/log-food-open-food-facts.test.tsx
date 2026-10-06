import { useMutation } from "convex/react";
import { PermissionStatus, useCameraPermissions } from "expo-camera";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { foodPhotos } from "../../../../data/food-photo-manager";
import type { FetchLike } from "../../../../data/open-food-facts";
import { renderApp } from "../../../../test-support/render-app";

const mockUseMutation = jest.mocked(useMutation);
const mockUseCameraPermissions = jest.mocked(useCameraPermissions);

function jsonResponse(status: number, body: unknown) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	};
}

const bakedBeans = {
	code: "5000112637922",
	product_name: "Baked Beans",
	product_name_en: "Baked Beans",
	product_name_nl: "Witte bonen in tomatensaus",
	brands: "Heinz",
	quantity: "415 g",
	serving_size: "Half can (207.5 g)",
	serving_quantity: 207.5,
	serving_quantity_unit: "g",
	image_front_small_url:
		"https://images.openfoodfacts.org/images/products/500/011/263/7922/front_en.40.200.jpg",
	nutriments: {
		"energy-kcal_100g": 75,
		proteins_100g: 4.8,
		carbohydrates_100g: 13,
		fat_100g: 0.2,
		"saturated-fat_100g": 0.1,
		fiber_100g: 3.7,
		sugars_100g: 5,
		salt_100g: 0.9,
	},
};

beforeEach(() => {
	jest.spyOn(foodPhotos, "importRemote").mockResolvedValue({
		kind: "photo",
		uri: "file:///documents/food-photos/baked-beans.jpg",
	});
	mockUseCameraPermissions.mockReturnValue([
		{
			status: PermissionStatus.GRANTED,
			granted: true,
			canAskAgain: true,
			expires: "never",
		},
		jest.fn(),
		jest.fn(),
	]);
});

afterEach(() => jest.restoreAllMocks());

describe("scanning a barcode", () => {
	it("checks local Personal Foods before calling Open Food Facts", async () => {
		const fetchImpl: FetchLike = jest.fn();
		const { repository } = renderApp("/nutrition", {}, fetchImpl);
		repository.create({
			name: { en: "Scanned Soup", nl: "Gescande soep" },
			baseUnit: "g",
			nutrients: {
				energy: { kind: "value", amount: 50 },
				protein: { kind: "absent" },
				carbs: { kind: "absent" },
				fat: { kind: "absent" },
				saturatedFat: { kind: "absent" },
				fibre: { kind: "absent" },
				sugars: { kind: "absent" },
				salt: { kind: "absent" },
			},
			servings: [],
			provenance: {
				recordOrigin: "import",
				nutritionSource: "openfoodfacts",
				locallyEdited: false,
				provider: "Open Food Facts",
				barcode: "5000112637922",
			},
		});

		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		fireEvent.press(screen.getByLabelText("Scan barcode"));
		fireEvent.press(await screen.findByLabelText("Simulated camera preview"));

		// The serving sheet opens over the results, so the name is both the
		// sheet's title and the row it came from.
		expect((await screen.findAllByText("Scanned Soup")).length).toBeGreaterThan(
			0,
		);
		expect(screen.getByText("Add & continue")).toBeTruthy();
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("opens an editable Food Import review, saves it as a Personal Food, and logs its provenance", async () => {
		const log = jest.fn().mockResolvedValue(undefined);
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, { status: 1, product: bakedBeans }),
		);
		const { repository } = renderApp("/nutrition", {}, fetchImpl);

		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		fireEvent.press(screen.getByLabelText("Scan barcode"));
		fireEvent.press(await screen.findByLabelText("Simulated camera preview"));

		expect(await screen.findByLabelText("Name")).toBeTruthy();
		expect(screen.getByDisplayValue("Baked Beans")).toBeTruthy();
		expect(screen.getByText(/Product data from Open Food Facts/)).toBeTruthy();
		expect(screen.getByText("Crop position")).toBeTruthy();
		fireEvent.press(screen.getByRole("radio", { name: "Right" }));
		fireEvent.press(screen.getByText("Save"));

		expect((await screen.findAllByText("Baked Beans")).length).toBeGreaterThan(
			0,
		);
		expect(repository.list()[0].visual).toEqual({
			kind: "photo",
			uri: "file:///documents/food-photos/baked-beans.jpg",
		});
		expect(foodPhotos.importRemote).toHaveBeenCalledWith(
			bakedBeans.image_front_small_url,
			"right",
		);
		fireEvent.press(screen.getByText("Add & continue"));

		await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
		expect(log.mock.calls[0][0].provenance).toMatchObject({
			source: "import",
			nutritionSource: "openfoodfacts",
			locallyEdited: true,
			provider: "Open Food Facts",
			barcode: "5000112637922",
		});
		expect(log.mock.calls[0][0].provenance.attribution).toMatch(
			/Open Food Facts/,
		);
	});

	it("still saves an imported food when its proposed photo cannot be downloaded", async () => {
		jest
			.mocked(foodPhotos.importRemote)
			.mockRejectedValueOnce(new Error("offline"));
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, { status: 1, product: bakedBeans }),
		);
		const { repository } = renderApp("/nutrition", {}, fetchImpl);

		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		fireEvent.press(screen.getByLabelText("Scan barcode"));
		fireEvent.press(await screen.findByLabelText("Simulated camera preview"));
		await screen.findByLabelText("Name");
		fireEvent.press(screen.getByText("Save"));

		await waitFor(() => expect(repository.list()).toHaveLength(1));
		expect(repository.list()[0].visual).toBeUndefined();
		// The neutral fallback, in the serving sheet and in the row behind it —
		// the pooled list shows the food you just saved without switching scope.
		expect(
			(await screen.findAllByLabelText("Baked Beans visual")).length,
		).toBeGreaterThan(0);
		expect(
			await screen.findByText(
				"The product was saved, but its photo could not be downloaded.",
			),
		).toBeTruthy();
	});

	it("marks a Food Import as locally edited only when the reviewer changes a field", async () => {
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, { status: 1, product: bakedBeans }),
		);
		const { repository } = renderApp("/nutrition", {}, fetchImpl);

		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		fireEvent.press(screen.getByLabelText("Scan barcode"));
		fireEvent.press(await screen.findByLabelText("Simulated camera preview"));
		await screen.findByLabelText("Name");

		fireEvent.changeText(
			screen.getByLabelText("Name"),
			"Baked Beans in Tomato Sauce",
		);
		fireEvent.press(screen.getByText("Save"));

		await waitFor(() => expect(repository.list()).toHaveLength(1));
		expect(repository.list()[0].provenance.locallyEdited).toBe(true);
	});

	it("keeps Search and Enter manually reachable when camera permission is refused", async () => {
		mockUseCameraPermissions.mockReturnValue([
			{
				status: PermissionStatus.DENIED,
				granted: false,
				canAskAgain: true,
				expires: "never",
			},
			jest.fn(),
			jest.fn(),
		]);
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		fireEvent.press(screen.getByLabelText("Scan barcode"));

		expect(await screen.findByText(/Camera access was refused/)).toBeTruthy();
		fireEvent.press(screen.getByLabelText("Close"));

		expect(await screen.findByPlaceholderText("Search foods")).toBeTruthy();
		expect(screen.getByLabelText("More food actions")).toBeTruthy();
	});

	it("keeps Search and Enter manually reachable when camera access is restricted", async () => {
		mockUseCameraPermissions.mockReturnValue([
			{
				status: PermissionStatus.DENIED,
				granted: false,
				canAskAgain: false,
				expires: "never",
			},
			jest.fn(),
			jest.fn(),
		]);
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Dinner"));
		fireEvent.press(screen.getByLabelText("Scan barcode"));

		expect(await screen.findByText(/Camera access is restricted/)).toBeTruthy();
		expect(screen.queryByText("Allow camera access")).toBeNull();
		fireEvent.press(screen.getByLabelText("Close"));

		expect(await screen.findByPlaceholderText("Search foods")).toBeTruthy();
	});

	it("offers next steps for an unknown barcode instead of an error", async () => {
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, { status: 0 }),
		);
		renderApp("/nutrition", {}, fetchImpl);
		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		fireEvent.press(screen.getByLabelText("Scan barcode"));
		fireEvent.press(await screen.findByLabelText("Simulated camera preview"));

		expect(await screen.findByText("Barcode not found")).toBeTruthy();
		expect(screen.getByText("5000112637922")).toBeTruthy();
		expect(screen.getByText("New Personal Food")).toBeTruthy();
		expect(screen.getByText("Search by name")).toBeTruthy();
		expect(screen.getByText("Scan again")).toBeTruthy();
	});

	it("links an unknown barcode to the Personal Food picked by name, so the next scan finds it", async () => {
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, { status: 0 }),
		);
		const { repository } = renderApp("/nutrition", {}, fetchImpl);
		repository.create({
			name: { en: "Mum's pasta", nl: "Pasta van mama" },
			baseUnit: "g",
			servings: [],
			nutrients: {
				energy: { kind: "value", amount: 150 },
				protein: { kind: "absent" },
				carbs: { kind: "absent" },
				fat: { kind: "absent" },
				saturatedFat: { kind: "absent" },
				fibre: { kind: "absent" },
				sugars: { kind: "absent" },
				salt: { kind: "absent" },
			},
			provenance: {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			},
		});
		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		fireEvent.press(screen.getByLabelText("Scan barcode"));
		fireEvent.press(await screen.findByLabelText("Simulated camera preview"));
		fireEvent.press(await screen.findByText("Search by name"));

		expect(
			await screen.findByText(
				"Choose one of your own foods for barcode 5000112637922",
			),
		).toBeTruthy();
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "pasta");
		fireEvent.press(await screen.findByText("Mum's pasta"));
		expect(
			await screen.findByText("Barcode linked to Mum's pasta"),
		).toBeTruthy();
		expect(repository.findByBarcode("5000112637922")?.name.en).toBe(
			"Mum's pasta",
		);
	});

	it("creates a Personal Food with the unknown barcode already filled in", async () => {
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, { status: 0 }),
		);
		renderApp("/nutrition", {}, fetchImpl);
		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		fireEvent.press(screen.getByLabelText("Scan barcode"));
		fireEvent.press(await screen.findByLabelText("Simulated camera preview"));
		fireEvent.press(await screen.findByText("New Personal Food"));

		expect(await screen.findByLabelText("Name")).toBeTruthy();
	});

	it.each([
		[
			"a rate limit",
			() => jsonResponse(429, {}),
			"Open Food Facts is receiving too many requests right now. Try again shortly.",
		],
		[
			"a product with no usable nutrition data",
			() =>
				jsonResponse(200, {
					status: 1,
					product: {
						code: "5000112637922",
						product_name: "Mystery",
						nutriments: {},
					},
				}),
			"This product has too little nutrition data to import.",
		],
	] as const)("keeps Search and Enter manually reachable on %s", async (_case, impl, message) => {
		const fetchImpl: FetchLike = jest.fn(async () => impl());
		renderApp("/nutrition", {}, fetchImpl);
		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		fireEvent.press(screen.getByLabelText("Scan barcode"));
		fireEvent.press(await screen.findByLabelText("Simulated camera preview"));

		expect(await screen.findByText(message)).toBeTruthy();
		expect(screen.getByPlaceholderText("Search foods")).toBeTruthy();
		expect(screen.getByLabelText("More food actions")).toBeTruthy();
	});

	it("reports a timed-out lookup distinctly and still leaves local exits reachable", async () => {
		// Rejecting with the same error `AbortController` produces exercises the
		// timeout mapping without waiting out the real request timeout.
		const fetchImpl: FetchLike = jest.fn(async () => {
			const error = new Error("aborted");
			error.name = "AbortError";
			throw error;
		});
		renderApp("/nutrition", {}, fetchImpl);
		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		fireEvent.press(screen.getByLabelText("Scan barcode"));
		fireEvent.press(await screen.findByLabelText("Simulated camera preview"));

		expect(
			await screen.findByText("The Open Food Facts request timed out."),
		).toBeTruthy();
		expect(screen.getByPlaceholderText("Search foods")).toBeTruthy();
	});
});

/** Submits the search field, as the keyboard's Search key does. */
function submitSearch(query: string) {
	const field = screen.getByPlaceholderText("Search foods");
	fireEvent.changeText(field, query);
	fireEvent(field, "submitEditing");
}

function product(code: string, name: string) {
	return { ...bakedBeans, code, product_name: name, product_name_en: name };
}

describe("Open Food Facts in the results", () => {
	it("shows downtime in its own section, keeps the query, and retries on Search", async () => {
		const fetchImpl = jest
			.fn()
			.mockResolvedValueOnce(jsonResponse(503, {}))
			.mockResolvedValueOnce(jsonResponse(200, { hits: [bakedBeans] }));
		renderApp("/nutrition", {}, fetchImpl);
		fireEvent.press(await screen.findByLabelText("Add food to Snacks"));
		submitSearch("baked beans");
		expect(await screen.findByTestId("off-search-feedback")).toHaveTextContent(
			/Open Food Facts is temporarily unavailable/,
		);
		expect(screen.getByDisplayValue("baked beans")).toBeTruthy();
		fireEvent(screen.getByPlaceholderText("Search foods"), "submitEditing");
		expect(await screen.findByText("Baked Beans")).toBeTruthy();
		expect(screen.queryByTestId("off-search-feedback")).toBeNull();
	});

	it("stays local while typing and asks once the term has settled", async () => {
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, { hits: [] }),
		);
		renderApp("/nutrition", {}, fetchImpl);
		fireEvent.press(await screen.findByLabelText("Add food to Snacks"));

		expect(screen.queryByTestId("off-section")).toBeNull();
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "apple");
		expect(await screen.findByText("Apple")).toBeTruthy();
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(screen.getByText("Search ‘apple’ in Open Food Facts")).toBeTruthy();
		await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1), {
			timeout: 3000,
		});
	});

	it("never asks on its own for a term under three characters", async () => {
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, { hits: [] }),
		);
		renderApp("/nutrition", {}, fetchImpl);
		fireEvent.press(await screen.findByLabelText("Add food to Snacks"));
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "ei");
		// The router test harness runs on fake timers: walk past the idle delay.
		act(() => jest.advanceTimersByTime(1700));
		expect(fetchImpl).not.toHaveBeenCalled();
		fireEvent.press(screen.getByText("Search ‘ei’ in Open Food Facts"));
		await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
	});

	it("lists online products under the local results and opens one for review", async () => {
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, { hits: [bakedBeans] }),
		);
		renderApp("/nutrition", {}, fetchImpl);
		fireEvent.press(await screen.findByLabelText("Add food to Snacks"));
		submitSearch("baked beans");

		expect(await screen.findByText("1 result")).toBeTruthy();
		expect(
			screen.getByText(
				/Open Food Facts · Heinz · 415 g · Half can \(207\.5 g\)/,
			),
		).toBeTruthy();
		fireEvent.press(screen.getByText("Baked Beans"));

		expect(await screen.findByLabelText("Name")).toBeTruthy();
	});

	it("shows the top three products and the rest on request", async () => {
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, {
				hits: ["1", "2", "3", "4", "5"].map((n) =>
					product(`871000000000${n}`, `Yoghurt ${n}`),
				),
			}),
		);
		renderApp("/nutrition", {}, fetchImpl);
		fireEvent.press(await screen.findByLabelText("Add food to Snacks"));
		submitSearch("yoghurt");

		expect(await screen.findByText("Yoghurt 3")).toBeTruthy();
		expect(screen.queryByText("Yoghurt 4")).toBeNull();
		fireEvent.press(screen.getByText("Show all 5"));
		expect(screen.getByText("Yoghurt 5")).toBeTruthy();
	});

	it("leaves out products whose barcode is already a Personal Food", async () => {
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, {
				hits: [product("111", "Already mine"), product("222", "New to me")],
			}),
		);
		const { repository } = renderApp("/nutrition", {}, fetchImpl);
		repository.create({
			name: { en: "My yoghurt", nl: "Mijn yoghurt" },
			baseUnit: "g",
			servings: [],
			nutrients: {
				energy: { kind: "value", amount: 60 },
				protein: { kind: "absent" },
				carbs: { kind: "absent" },
				fat: { kind: "absent" },
				saturatedFat: { kind: "absent" },
				fibre: { kind: "absent" },
				sugars: { kind: "absent" },
				salt: { kind: "absent" },
			},
			provenance: {
				recordOrigin: "import",
				nutritionSource: "openfoodfacts",
				locallyEdited: false,
				barcode: "111",
			},
		});
		fireEvent.press(await screen.findByLabelText("Add food to Snacks"));
		submitSearch("yoghurt");

		expect(await screen.findByText("New to me")).toBeTruthy();
		expect(screen.queryByText("Already mine")).toBeNull();
	});

	it("counts down only its own section when rate-limited", async () => {
		const fetchImpl: FetchLike = jest.fn(async () => jsonResponse(429, {}));
		renderApp("/nutrition", {}, fetchImpl);
		fireEvent.press(await screen.findByLabelText("Add food to Snacks"));
		submitSearch("apple");

		expect(
			await screen.findByText(
				/Open Food Facts needs a moment\. We'll search again automatically in \d+ s\./,
			),
		).toBeTruthy();
		expect(screen.getByText("Scan the barcode instead")).toBeTruthy();
		expect(screen.getByText("Apple")).toBeTruthy();
	});

	it("turns a search with no matches anywhere into a way forward", async () => {
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, { hits: [] }),
		);
		renderApp("/nutrition", {}, fetchImpl);
		fireEvent.press(await screen.findByLabelText("Add food to Snacks"));
		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"zzzznotfound",
		);

		expect(
			await screen.findByText("No results for ‘zzzznotfound’"),
		).toBeTruthy();
		fireEvent.press(screen.getByText("Search Open Food Facts"));
		expect(
			await screen.findByText("Nothing in Open Food Facts for ‘zzzznotfound’."),
		).toBeTruthy();
		fireEvent.press(screen.getByText("New Personal Food ‘zzzznotfound’"));
		// The editor opens with the typed term as the food's name.
		expect(await screen.findByLabelText("Name")).toHaveProp(
			"value",
			"zzzznotfound",
		);
	});
});
