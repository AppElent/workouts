import { assertMessageParity } from "@appelent/i18n/test-utils";
import { en } from "./messages/en";
import { nl } from "./messages/nl";

assertMessageParity({ en, nl });
