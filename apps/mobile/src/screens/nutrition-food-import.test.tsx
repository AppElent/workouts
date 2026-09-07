import { useMutation } from "convex/react";
import { PermissionStatus, useCameraPermissions } from "expo-camera";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import type { FetchLike } from "../data/open-food-facts";
import { renderApp } from "../test-support/render-app";

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
		fireEvent.press(screen.getByText("Scan barcode"));
		fireEvent.press(await screen.findByLabelText("Simulated camera preview"));

		// The serving sheet opens over the results, so the name is both the
		// sheet's title and the row it came from.
		expect((await screen.findAllByText("Scanned Soup")).length).toBeGreaterThan(
			0,
		);
		expect(screen.getByText("Log food")).toBeTruthy();
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("opens an editable Food Import review, saves it as an unedited Personal Food, and logs its provenance", async () => {
		const log = jest.fn().mockResolvedValue(undefined);
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, { status: 1, product: bakedBeans }),
		);
		renderApp("/nutrition", {}, fetchImpl);

		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		fireEvent.press(screen.getByText("Scan barcode"));
		fireEvent.press(await screen.findByLabelText("Simulated camera preview"));

		expect(await screen.findByText("Review imported food")).toBeTruthy();
		expect(screen.getByDisplayValue("Baked Beans")).toBeTruthy();
		expect(screen.getByText(/Product data from Open Food Facts/)).toBeTruthy();
		fireEvent.press(screen.getByText("Save Personal Food"));

		expect((await screen.findAllByText("Baked Beans")).length).toBeGreaterThan(
			0,
		);
		fireEvent.press(screen.getByText("Log food"));

		await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
		expect(log.mock.calls[0][0].provenance).toMatchObject({
			source: "import",
			nutritionSource: "openfoodfacts",
			locallyEdited: false,
			provider: "Open Food Facts",
			barcode: "5000112637922",
		});
		expect(log.mock.calls[0][0].provenance.attribution).toMatch(
			/Open Food Facts/,
		);
	});

	it("marks a Food Import as locally edited only when the reviewer changes a field", async () => {
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, { status: 1, product: bakedBeans }),
		);
		const { repository } = renderApp("/nutrition", {}, fetchImpl);

		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		fireEvent.press(screen.getByText("Scan barcode"));
		fireEvent.press(await screen.findByLabelText("Simulated camera preview"));
		await screen.findByText("Review imported food");

		fireEvent.changeText(
			screen.getByLabelText("English name"),
			"Baked Beans in Tomato Sauce",
		);
		fireEvent.press(screen.getByText("Save Personal Food"));

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
		fireEvent.press(screen.getByText("Scan barcode"));

		expect(await screen.findByText(/Camera access was refused/)).toBeTruthy();
		fireEvent.press(screen.getByLabelText("Go back"));

		expect(await screen.findByPlaceholderText("Search foods")).toBeTruthy();
		expect(screen.getByText("Create Personal Food")).toBeTruthy();
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
		fireEvent.press(screen.getByText("Scan barcode"));

		expect(await screen.findByText(/Camera access is restricted/)).toBeTruthy();
		expect(screen.queryByText("Allow camera access")).toBeNull();
		fireEvent.press(screen.getByLabelText("Go back"));

		expect(await screen.findByPlaceholderText("Search foods")).toBeTruthy();
	});

	it.each([
		[
			"an unknown barcode",
			() => jsonResponse(200, { status: 0 }),
			"No product was found for this barcode.",
		],
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
		fireEvent.press(screen.getByText("Scan barcode"));
		fireEvent.press(await screen.findByLabelText("Simulated camera preview"));

		expect(await screen.findByText(message)).toBeTruthy();
		expect(screen.getByPlaceholderText("Search foods")).toBeTruthy();
		expect(screen.getByText("Create Personal Food")).toBeTruthy();
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
		fireEvent.press(screen.getByText("Scan barcode"));
		fireEvent.press(await screen.findByLabelText("Simulated camera preview"));

		expect(
			await screen.findByText("The Open Food Facts request timed out."),
		).toBeTruthy();
		expect(screen.getByPlaceholderText("Search foods")).toBeTruthy();
	});
});

describe("the explicit Open Food Facts search", () => {
	it("is hidden until a query is typed and never fires on ordinary local search", async () => {
		const fetchImpl: FetchLike = jest.fn();
		renderApp("/nutrition", {}, fetchImpl);
		fireEvent.press(await screen.findByLabelText("Add food to Snacks"));

		expect(screen.queryByText("Search Open Food Facts")).toBeNull();
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "apple");
		expect(await screen.findByText("Apple")).toBeTruthy();
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(screen.getByText("Search Open Food Facts")).toBeTruthy();
	});

	it("finds an online result and opens it for review before it can be logged", async () => {
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, { products: [bakedBeans] }),
		);
		renderApp("/nutrition", {}, fetchImpl);
		fireEvent.press(await screen.findByLabelText("Add food to Snacks"));
		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"baked beans",
		);
		fireEvent.press(await screen.findByText("Search Open Food Facts"));

		expect(await screen.findByText("Open Food Facts results")).toBeTruthy();
		fireEvent.press(screen.getByText("Baked Beans"));

		expect(await screen.findByText("Review imported food")).toBeTruthy();
	});

	it("reports no online matches without disturbing local Search or Enter manually", async () => {
		const fetchImpl: FetchLike = jest.fn(async () =>
			jsonResponse(200, { products: [] }),
		);
		renderApp("/nutrition", {}, fetchImpl);
		fireEvent.press(await screen.findByLabelText("Add food to Snacks"));
		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"zzzznotfound",
		);
		fireEvent.press(await screen.findByText("Search Open Food Facts"));

		expect(
			await screen.findByText(
				"No Open Food Facts products matched your search.",
			),
		).toBeTruthy();
		expect(screen.getByPlaceholderText("Search foods")).toBeTruthy();
		expect(screen.getByText("Create Personal Food")).toBeTruthy();
	});
});
