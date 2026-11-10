/**
 * The personal library sync protocol between the device and Convex. A device
 * writes the current versions; the server still accepts every version in
 * LIBRARY_SCHEMA_VERSIONS because older app builds keep syncing.
 */
export const LIBRARY_SCHEMA_VERSIONS = [1, 2, 3] as const;
export type LibrarySchemaVersion = (typeof LIBRARY_SCHEMA_VERSIONS)[number];

/** Version 3 payloads may carry account photos (stored or remote visuals). */
export const LIBRARY_SCHEMA_VERSION = 3 satisfies LibrarySchemaVersion;

/** The first version whose payloads may carry estimates, visuals and serving units. */
export const LIBRARY_FIELDS_SCHEMA_VERSION = 2 satisfies LibrarySchemaVersion;

/**
 * Readers that send this version receive account photos; older readers get
 * those foods without a visual.
 */
export const PHOTO_VERSION = 3;

export const LIBRARY_RECORD_KINDS = ["food", "combo"] as const;
export type LibraryRecordKind = (typeof LIBRARY_RECORD_KINDS)[number];

/** Library browse categories: a food record is a food or a recipe. */
export const LIBRARY_CATEGORIES = ["food", "recipe", "combo"] as const;
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];

/** Most ids one `getMany` call accepts. */
export const LIBRARY_GET_MANY_LIMIT = 100;
