/**
 * NEVO licence obligations, expressed as constants so they cannot be forgotten.
 *
 * ------------------------------------------------------------------------
 *  READ THIS BEFORE PUTTING THE NUTRITION MODULE BEHIND A PAYWALL.
 *
 *  The NEVO-online 2025 conditions of use forbid charging end users for the
 *  data. If Workouts ever becomes a paid product — subscription, one-off
 *  purchase, paid tier that includes the diary — the bundled NEVO dataset
 *  must be REMOVED or SEPARATELY RELICENSED with RIVM first. Deleting the
 *  shipped artifact is a product decision, not a build detail: the food
 *  library is the module's whole starting point.
 *
 *  See `NEVO_LICENCE_CONSTRAINTS` below, ADR 0006, and the licence PDF at
 *  `data/nevo/Conditions of use NEVO-online 2025 dataset.pdf`.
 * ------------------------------------------------------------------------
 */

/**
 * The exact reference the licence requires on calculation output. Quoted
 * verbatim from the conditions of use — do not translate it, reword it, or
 * split it across lines in the UI.
 *
 * "Any output from software for nutritional calculations produced by the user
 * must contain one of the following references."
 */
export const NEVO_ATTRIBUTION = "Based on data from NEVO online version 2025/9.0, RIVM, Bilthoven";

/**
 * The variant to use as soon as anything that is not a shipped food can enter
 * a total — a Personal Food, a Combo, an Open Food Facts import. In practice
 * that means the day view, whose totals mix sources by design.
 */
export const NEVO_ATTRIBUTION_MIXED =
	"Based on data from NEVO online version 2025/9.0, RIVM, Bilthoven and other data sources";

/**
 * Pick the attribution line for a set of totals.
 *
 * @param onlyShippedSources - true when every contributing figure came from the
 *   shipped NEVO library and nothing else.
 */
export function nevoAttribution(onlyShippedSources: boolean): string {
	return onlyShippedSources ? NEVO_ATTRIBUTION : NEVO_ATTRIBUTION_MIXED;
}

/**
 * The disclosure that accompanies any salt figure. NEVO publishes sodium, not
 * salt; the salt column is an Appelent addition and the licence requires
 * additions to be clearly marked as additions and to say what they apply to.
 *
 * This one IS translated — it is our sentence, not RIVM's.
 */
export const SALT_DERIVATION_DISCLOSURE: { en: string; nl: string } = {
	en: "Salt is not published by NEVO. Workouts derives it from the source sodium figure as salt (g) = sodium (mg) × 2.5 / 1000.",
	nl: "Zout wordt niet door NEVO gepubliceerd. Workouts leidt het af uit de natriumwaarde als zout (g) = natrium (mg) × 2,5 / 1000.",
};

/** The three licence clauses that bind what the app may do with this data. */
export const NEVO_LICENCE_CONSTRAINTS: readonly string[] = Object.freeze([
	"Redistribute the dataset unchanged. Additions are permitted only where it is clear they are additions and which parts they apply to; amending NEVO's own values or names is not.",
	"Every output of a nutritional calculation must carry the NEVO reference — this attaches to the day view and to any screen showing totals, not to an about screen.",
	"End users may not be charged for the data. Remove or separately relicense the dataset before shipping any paid product that includes this diary.",
]);

/** Where a future reader can check all of the above. */
export const NEVO_LICENCE_SOURCE = "data/nevo/Conditions of use NEVO-online 2025 dataset.pdf";
