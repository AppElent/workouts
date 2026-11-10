/**
 * The personal library sync protocol between the device and Convex. The server
 * stamps every write with LIBRARY_SCHEMA_VERSION; stored rows written by older
 * builds may still carry any version in LIBRARY_SCHEMA_VERSIONS.
 */
export const LIBRARY_SCHEMA_VERSIONS = [1, 2, 3] as const;
type LibrarySchemaVersion = (typeof LIBRARY_SCHEMA_VERSIONS)[number];

/** Version 3 payloads may carry account photos (stored or remote visuals). */
export const LIBRARY_SCHEMA_VERSION = 3 satisfies LibrarySchemaVersion;

export const LIBRARY_RECORD_KINDS = ["food", "combo"] as const;
export type LibraryRecordKind = (typeof LIBRARY_RECORD_KINDS)[number];

/** Library browse categories: a food record is a food or a recipe. */
export const LIBRARY_CATEGORIES = ["food", "recipe", "combo"] as const;
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];

/** Most ids one `getMany` call accepts. */
export const LIBRARY_GET_MANY_LIMIT = 100;
