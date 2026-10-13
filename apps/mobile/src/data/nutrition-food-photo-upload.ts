import { useAuth } from "@clerk/expo";
import { useMutation } from "convex/react";
import { fetch } from "expo/fetch";
import { File } from "expo-file-system";
import { useCallback, useRef } from "react";
import { z } from "zod";
import { api, type Id } from "../convex/api";

const uploadedPhoto = z.object({
	storageId: z.custom<Id<"_storage">>(
		(value) => typeof value === "string" && value.length > 0,
	),
});
export type FoodPhotoUpload = (
	uri: string,
) => Promise<{ storageId: Id<"_storage"> }>;

/** Files enter account ownership before any Food or Diary save references them. */
export function useFoodPhotoUpload(): FoodPhotoUpload {
	const { userId } = useAuth();
	const generateUploadUrl = useMutation(
		api.nutritionFoodPhotos.generateUploadUrl,
	);
	const registerUpload = useMutation(api.nutritionFoodPhotos.registerUpload);
	const uploads = useRef(
		new Map<string, Promise<{ storageId: Id<"_storage"> }>>(),
	);
	return useCallback(
		(uri: string) => {
			const key = JSON.stringify([userId, uri]);
			const existing = uploads.current.get(key);
			if (existing) return existing;
			const upload = async () => {
				if (!userId) throw new Error("Sign in to upload a photo.");
				const url = await generateUploadUrl({ expectedSubject: userId });
				const response = await fetch(url, {
					method: "POST",
					headers: { "Content-Type": "image/jpeg" },
					body: new File(uri),
				});
				if (!response.ok)
					throw new Error("The food photo could not be uploaded.");
				const result = uploadedPhoto.parse(await response.json());
				await registerUpload({ ...result, expectedSubject: userId });
				return result;
			};
			const pending = upload().catch((error: unknown) => {
				uploads.current.delete(key);
				throw error;
			});
			uploads.current.set(key, pending);
			return pending;
		},
		[generateUploadUrl, registerUpload, userId],
	);
}

/** Frozen Diary snapshots carry durable photo IDs, never newly created file paths. */
export async function prepareDiaryPhotoOperation(
	operation: import("@foundry/core").NutritionDiaryOperation,
	upload: FoodPhotoUpload,
): Promise<import("@foundry/core").NutritionDiaryOperation> {
	async function entry<
		T extends { visual?: import("@foundry/core").FoodVisual },
	>(value: T): Promise<T> {
		if (value.visual?.kind !== "photo") return value;
		const photo = value.visual.storageId
			? { storageId: value.visual.storageId }
			: await upload(value.visual.uri);
		return { ...value, visual: { kind: "photo", uri: "", ...photo } };
	}
	if (operation.kind === "create")
		return { ...operation, entry: await entry(operation.entry) };
	if (operation.kind === "createBatch")
		return {
			...operation,
			entries: await Promise.all(operation.entries.map(entry)),
		};
	return operation;
}
