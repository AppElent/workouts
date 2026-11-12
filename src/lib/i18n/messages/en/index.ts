import { auth } from "./auth";
import { common } from "./common";
import { errors } from "./errors";
import { mcpViews } from "./mcp-views";
import { nav } from "./nav";
import { privacy } from "./privacy";
import { shell } from "./shell";
import { testData } from "./test-data";

export const en = {
	auth,
	common,
	errors,
	mcpViews,
	nav,
	privacy,
	shell,
	testData,
};
export type Messages = typeof en;
