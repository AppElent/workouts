import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import type { FoodVisual } from "./personal-food-repository";

export type FoodPhotoSource = "camera" | "library";
export type FoodPhotoCropPosition =
	| "center"
	| "top"
	| "bottom"
	| "left"
	| "right";

export type FoodPhotoChoice =
	| {
			readonly kind: "selected";
			readonly visual: Extract<FoodVisual, { kind: "photo" }>;
	  }
	| { readonly kind: "cancelled" }
	| { readonly kind: "denied" };

export type FoodPhotoNativeAdapter = {
	requestPermission(source: FoodPhotoSource): Promise<boolean>;
	pickSquare(source: FoodPhotoSource): Promise<string | null>;
	download(url: string): Promise<string>;
	prepareSquare(uri: string, position: FoodPhotoCropPosition): Promise<string>;
	persist(temporaryUri: string): Promise<string>;
	remove(uri: string): void;
	exists(uri: string): boolean;
	listManaged(): string[];
};

export type FoodPhotoManager = {
	choose(source: FoodPhotoSource): Promise<FoodPhotoChoice>;
	importRemote(
		url: string,
		position?: FoodPhotoCropPosition,
	): Promise<Extract<FoodVisual, { kind: "photo" }>>;
	remove(visual: FoodVisual | undefined): void;
	isAvailable(visual: FoodVisual | undefined): boolean;
	removeOrphans(referenced: readonly FoodVisual[]): void;
};

export function createFoodPhotoManager(
	native: FoodPhotoNativeAdapter = expoFoodPhotoAdapter,
): FoodPhotoManager {
	async function manage(
		temporaryUri: string,
		position: FoodPhotoCropPosition = "center",
	) {
		const prepared = await native.prepareSquare(temporaryUri, position);
		try {
			return await native.persist(prepared);
		} finally {
			native.remove(prepared);
		}
	}

	return {
		async choose(source) {
			if (!(await native.requestPermission(source))) return { kind: "denied" };
			const selected = await native.pickSquare(source);
			if (!selected) return { kind: "cancelled" };
			return {
				kind: "selected",
				visual: { kind: "photo", uri: await manage(selected) },
			};
		},
		async importRemote(url, position = "center") {
			const downloaded = await native.download(url);
			try {
				return { kind: "photo", uri: await manage(downloaded, position) };
			} finally {
				native.remove(downloaded);
			}
		},
		remove(visual) {
			if (visual?.kind === "photo") native.remove(visual.uri);
		},
		isAvailable(visual) {
			return visual?.kind !== "photo" || native.exists(visual.uri);
		},
		removeOrphans(referenced) {
			const keep = new Set(
				referenced.flatMap((visual) =>
					visual.kind === "photo" ? [visual.uri] : [],
				),
			);
			for (const uri of native.listManaged()) {
				if (!keep.has(uri)) native.remove(uri);
			}
		},
	};
}

function uniqueJpegName() {
	const random = Math.random().toString(36).slice(2);
	return `food-${Date.now()}-${random}.jpg`;
}

function removeIfPresent(uri: string) {
	const file = new File(uri);
	if (file.exists) file.delete();
}

const expoFoodPhotoAdapter: FoodPhotoNativeAdapter = {
	async requestPermission(source) {
		const permission =
			source === "camera"
				? await ImagePicker.requestCameraPermissionsAsync()
				: await ImagePicker.requestMediaLibraryPermissionsAsync();
		return permission.granted;
	},
	async pickSquare(source) {
		const options: ImagePicker.ImagePickerOptions = {
			mediaTypes: ["images"],
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.82,
			exif: false,
		};
		const result =
			source === "camera"
				? await ImagePicker.launchCameraAsync(options)
				: await ImagePicker.launchImageLibraryAsync(options);
		return result.canceled ? null : (result.assets[0]?.uri ?? null);
	},
	async download(url) {
		const destination = new File(Paths.cache, uniqueJpegName());
		return (await File.downloadFileAsync(url, destination)).uri;
	},
	async prepareSquare(uri, position) {
		const measured = await ImageManipulator.manipulate(uri).renderAsync();
		const sourceEdge = Math.min(measured.width, measured.height);
		const outputEdge = Math.min(512, sourceEdge);
		const context = ImageManipulator.manipulate(measured);
		context.crop({
			originX:
				position === "left"
					? 0
					: position === "right"
						? measured.width - sourceEdge
						: Math.round((measured.width - sourceEdge) / 2),
			originY:
				position === "top"
					? 0
					: position === "bottom"
						? measured.height - sourceEdge
						: Math.round((measured.height - sourceEdge) / 2),
			width: sourceEdge,
			height: sourceEdge,
		});
		if (outputEdge !== sourceEdge) {
			context.resize({ width: outputEdge, height: outputEdge });
		}
		const rendered = await context.renderAsync();
		return (
			await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG })
		).uri;
	},
	async persist(temporaryUri) {
		const directory = new Directory(Paths.document, "food-photos");
		directory.create({ intermediates: true, idempotent: true });
		const destination = new File(directory, uniqueJpegName());
		await new File(temporaryUri).copy(destination);
		return destination.uri;
	},
	remove: removeIfPresent,
	exists(uri) {
		return new File(uri).exists;
	},
	listManaged() {
		const directory = new Directory(Paths.document, "food-photos");
		if (!directory.exists) return [];
		return directory
			.list()
			.filter((entry): entry is File => entry instanceof File)
			.map((file) => file.uri);
	},
};

export const foodPhotos = createFoodPhotoManager();
