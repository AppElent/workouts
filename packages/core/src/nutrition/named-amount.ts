import { type RuleResult, ruleIssues } from "../rules";

/**
 * A named amount of a base unit: a Personal Measure ("my mug", 250 ml) or a
 * supplementary serving on a shipped food ("slice", 35 g).
 */
const NAMED_AMOUNT_KINDS = ["measure", "serving"] as const;
type NamedAmountKind = (typeof NAMED_AMOUNT_KINDS)[number];

export const NAMED_AMOUNT_LIMITS = { maxName: 40, maxAmount: 10_000 } as const;

type NamedAmountField = "name" | "amount";
type NamedAmountCode =
	| "required"
	| "tooLong"
	| "notPositive"
	| "tooLarge"
	| "tooPrecise";

type NamedAmount = {
	readonly name: string;
	/** Case-folded name; one user cannot hold two with the same key. */
	readonly normalizedName: string;
	readonly amount: number;
};

/**
 * Personal Measures allow at most one decimal place; supplementary servings
 * have never enforced it, and existing rows may hold finer amounts.
 */
export function validateNamedAmount(
	input: { readonly name: string; readonly amount: number },
	kind: NamedAmountKind,
): RuleResult<NamedAmount, NamedAmountField, NamedAmountCode> {
	const issues = ruleIssues<NamedAmountField, NamedAmountCode>();
	const name = input.name.trim();
	if (!name) issues.add("name", "required");
	else if (name.length > NAMED_AMOUNT_LIMITS.maxName)
		issues.add("name", "tooLong");
	const { amount } = input;
	if (!Number.isFinite(amount) || amount <= 0)
		issues.add("amount", "notPositive");
	else if (amount > NAMED_AMOUNT_LIMITS.maxAmount)
		issues.add("amount", "tooLarge");
	else if (
		kind === "measure" &&
		Math.abs(amount * 10 - Math.round(amount * 10)) > 1e-9
	)
		issues.add("amount", "tooPrecise");
	return issues.result({ name, normalizedName: name.toLowerCase(), amount });
}
