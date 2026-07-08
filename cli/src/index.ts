#!/usr/bin/env node
import { runCli } from "./run";

const result = await runCli(process.argv.slice(2), {
	writeOut: (value) => console.log(value),
	writeErr: (value) => console.error(value),
	env: process.env,
});

process.exitCode = result.exitCode;
