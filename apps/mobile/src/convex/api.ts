/**
 * `convex/_generated` lives at the repo root and crosses into the app by deep
 * relative path, not by workspace package. The app is a second client of the
 * web app's Convex deployment and Clerk tenant.
 */
export { api } from "../../../../convex/_generated/api";
export type { Doc, Id } from "../../../../convex/_generated/dataModel";
