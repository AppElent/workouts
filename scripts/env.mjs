#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { runEnvCli } from "@appelent/dev/env";

const root = fileURLToPath(new URL("..", import.meta.url));
const { exitCode } = await runEnvCli(process.argv.slice(2), { root });
process.exitCode = exitCode;
