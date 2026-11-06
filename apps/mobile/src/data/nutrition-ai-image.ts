import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export type ImageInput = { mediaType: "image/jpeg"; base64: string };

/** Long edge in pixels: label digits stay legible, the upload stays small. */
const IMAGE_EDGE = 1600;

/** Downscale and re-encode a camera or library photo for the AI call. */
export async function prepareImage(uri: string): Promise<ImageInput> {
	const measured = await ImageManipulator.manipulate(uri).renderAsync();
	const scale = Math.min(
		1,
		IMAGE_EDGE / Math.max(measured.width, measured.height),
	);
	const context = ImageManipulator.manipulate(measured);
	if (scale < 1)
		context.resize({
			width: Math.round(measured.width * scale),
			height: Math.round(measured.height * scale),
		});
	const image = await context.renderAsync();
	const saved = await image.saveAsync({
		format: SaveFormat.JPEG,
		compress: 0.7,
		base64: true,
	});
	if (!saved.base64) throw new Error("The photo could not be encoded.");
	return { mediaType: "image/jpeg", base64: saved.base64 };
}
