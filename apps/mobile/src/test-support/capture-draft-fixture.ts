import { mintUuid } from "../data/account-write";
import type {
	CaptureDraft,
	CaptureDraftInput,
} from "../data/nutrition-capture-draft";
export function createCaptureDraftFixture() {
	const records = new Map<string, CaptureDraft>();
	return {
		list(subject: string) {
			return [...records.values()].filter((draft) => draft.subject === subject);
		},
		create(subject: string, input: CaptureDraftInput) {
			const draft = {
				...input,
				subject,
				id: mintUuid(),
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};
			records.set(draft.id, draft);
			return draft;
		},
	};
}
export type CaptureDraftFixture = ReturnType<typeof createCaptureDraftFixture>;
