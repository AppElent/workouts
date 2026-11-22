import { account } from "./account";
import { auth } from "./auth";
import { common } from "./common";
import { errors } from "./errors";
import { hosted } from "./hosted";
import { mcpViews } from "./mcp-views";
import { nav } from "./nav";
import { privacy } from "./privacy";
import { shell } from "./shell";
import { support } from "./support";
import { testData } from "./test-data";
import { wods } from "./wods";

export const en = {
	account,
	auth,
	common,
	errors,
	hosted,
	mcpViews,
	nav,
	privacy,
	shell,
	support,
	testData,
	wods,
};
export type Messages = typeof en;
