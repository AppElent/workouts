import type { Messages } from "../en";
import { common } from "./common";
import { nav } from "./nav";
import { shell } from "./shell";

export const nl = { common, nav, shell } satisfies Messages;
