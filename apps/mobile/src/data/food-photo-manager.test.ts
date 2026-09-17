import {
	createFoodPhotoManager,
	type FoodPhotoNativeAdapter,
} from "./food-photo-manager";

function adapter(
	overrides: Partial<FoodPhotoNativeAdapter> = {},
): FoodPhotoNativeAdapter {
	return {
		requestPermission: jest.fn().mockResolvedValue(true),
		pickSquare: jest.fn().mockResolvedValue("file:///picker/chosen.jpg"),
		download: jest.fn().mockResolvedValue("file:///cache/provider.jpg"),
		prepareSquare: jest.fn().mockResolvedValue("file:///cache/prepared.jpg"),
		persist: jest
			.fn()
			.mockResolvedValue("file:///documents/food-photos/managed.jpg"),
		remove: jest.fn(),
		exists: jest.fn().mockReturnValue(true),
		listManaged: jest.fn().mockReturnValue([]),
		...overrides,
	};
}

describe("Food photo manager", () => {
	it("requests only the chosen permission and returns denial as an ordinary outcome", async () => {
		const native = adapter({
			requestPermission: jest.fn().mockResolvedValue(false),
		});
		const photos = createFoodPhotoManager(native);

		expect(await photos.choose("camera")).toEqual({ kind: "denied" });
		expect(native.requestPermission).toHaveBeenCalledWith("camera");
		expect(native.pickSquare).not.toHaveBeenCalled();
		expect(native.prepareSquare).not.toHaveBeenCalled();
	});

	it("preserves the current Food Visual when the square editor is cancelled", async () => {
		const native = adapter({ pickSquare: jest.fn().mockResolvedValue(null) });
		const photos = createFoodPhotoManager(native);

		expect(await photos.choose("library")).toEqual({ kind: "cancelled" });
		expect(native.prepareSquare).not.toHaveBeenCalled();
		expect(native.persist).not.toHaveBeenCalled();
	});

	it("normalizes a confirmed square and returns only its managed local file", async () => {
		const native = adapter();
		const photos = createFoodPhotoManager(native);

		expect(await photos.choose("library")).toEqual({
			kind: "selected",
			visual: {
				kind: "photo",
				uri: "file:///documents/food-photos/managed.jpg",
			},
		});
		expect(native.pickSquare).toHaveBeenCalledWith("library");
		expect(native.prepareSquare).toHaveBeenCalledWith(
			"file:///picker/chosen.jpg",
			"center",
		);
		expect(native.persist).toHaveBeenCalledWith("file:///cache/prepared.jpg");
	});

	it("downloads and manages a provider photo without requesting media permission", async () => {
		const native = adapter();
		const photos = createFoodPhotoManager(native);

		expect(
			await photos.importRemote(
				"https://images.openfoodfacts.org/product.jpg",
				"right",
			),
		).toEqual({
			kind: "photo",
			uri: "file:///documents/food-photos/managed.jpg",
		});
		expect(native.requestPermission).not.toHaveBeenCalled();
		expect(native.download).toHaveBeenCalledWith(
			"https://images.openfoodfacts.org/product.jpg",
		);
		expect(native.prepareSquare).toHaveBeenCalledWith(
			"file:///cache/provider.jpg",
			"right",
		);
	});

	it("removes only unreferenced managed files and reports missing photos", () => {
		const native = adapter({
			listManaged: jest
				.fn()
				.mockReturnValue([
					"file:///documents/food-photos/keep.jpg",
					"file:///documents/food-photos/orphan.jpg",
				]),
			exists: jest.fn().mockReturnValue(false),
		});
		const photos = createFoodPhotoManager(native);

		photos.removeOrphans([
			{
				kind: "photo",
				uri: "file:///documents/food-photos/keep.jpg",
			},
		]);

		expect(native.remove).toHaveBeenCalledTimes(1);
		expect(native.remove).toHaveBeenCalledWith(
			"file:///documents/food-photos/orphan.jpg",
		);
		expect(
			photos.isAvailable({
				kind: "photo",
				uri: "file:///documents/food-photos/missing.jpg",
			}),
		).toBe(false);
	});
});
