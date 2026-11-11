/** The personal library sync protocol between the device and Convex. */
export const LIBRARY_RECORD_KINDS = ["food", "combo"] as const;
export type LibraryRecordKind = (typeof LIBRARY_RECORD_KINDS)[number];

export const LIBRARY_CATEGORIES = ["food", "recipe", "combo"] as const;
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];

/** Most ids one `getMany` call accepts. */
export const LIBRARY_GET_MANY_LIMIT = 100;
