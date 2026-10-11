import { common } from "./common";
import { nav } from "./nav";
import { shell } from "./shell";
import { testData } from "./test-data";

export const en = { common, nav, shell, testData };
export type Messages = typeof en;
