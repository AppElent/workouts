import { auth } from "./auth";
import { common } from "./common";
import { errors } from "./errors";
import { nav } from "./nav";
import { privacy } from "./privacy";
import { shell } from "./shell";
import { support } from "./support";
import { testData } from "./test-data";

export const en = {
	auth,
	common,
	errors,
	nav,
	privacy,
	shell,
	support,
	testData,
};
export type Messages = typeof en;
