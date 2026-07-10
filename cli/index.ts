#!/usr/bin/env node
import { createCli } from "@appelent/cli";

const { runCli } = createCli({ appName: "workouts" });

const result = await runCli(process.argv.slice(2), {
	writeOut: (value) => console.log(value),
	writeErr: (value) => console.error(value),
	env: process.env,
});

process.exitCode = result.exitCode;
