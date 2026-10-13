import { en } from "./messages/en";
import { nl } from "./messages/nl";
import { assertMessageParity } from "./runtime/test-utils";

assertMessageParity({ en, nl });
