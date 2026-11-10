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

/** Most ids one `getMany` call accepts. */
export const LIBRARY_GET_MANY_LIMIT = 100;
