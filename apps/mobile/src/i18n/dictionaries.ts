import type { Locale } from "@foundry/core";
import { en, type Messages } from "./messages/en";
import { nl } from "./messages/nl";

export type { Messages };

export const DICTIONARIES: Record<Locale, Messages> = { en, nl };
