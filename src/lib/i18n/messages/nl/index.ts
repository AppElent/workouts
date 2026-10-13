import type { Messages } from "../en";
import { common } from "./common";
import { nav } from "./nav";
import { privacy } from "./privacy";
import { shell } from "./shell";
import { testData } from "./test-data";

export const nl = { common, nav, privacy, shell, testData } satisfies Messages;
