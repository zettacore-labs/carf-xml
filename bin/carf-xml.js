#!/usr/bin/env node
import { ignoreBrokenPipe, runCli } from "../dist/cli/main.js";

ignoreBrokenPipe(process.stdout);
ignoreBrokenPipe(process.stderr);

process.exitCode = await runCli(process.argv.slice(2), {
  out: (text) => {
    process.stdout.write(`${text}\n`);
  },
  err: (text) => {
    process.stderr.write(`${text}\n`);
  },
  env: process.env,
});
