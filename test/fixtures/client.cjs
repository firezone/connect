#!/usr/bin/env node
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { readFileSync, statSync } = require("node:fs");
const { parseArgs } = require("node:util");

const { values } = parseArgs({
  options: {
    "token-path": { type: "string" },
    "firezone-id": { type: "string" },
    "firezone-name": { type: "string" },
  },
});
const tokenPath = values["token-path"];
const stat = statSync(tokenPath);

assert.equal(stat.uid, 0);
assert.equal(stat.gid, 0);
assert.equal(stat.mode & 0o777, 0o600);
assert.equal(readFileSync(tokenPath, "utf8"), "fixture-token");

process.on("SIGTERM", () => {
  console.log("graceful shutdown");
  process.exit(0);
});

if (values["firezone-name"] !== "timeout") {
  execFileSync("systemd-notify", ["--ready", `--pid=${process.pid}`]);
  console.log(`ready ${values["firezone-name"]}`);
  console.log(`log filter ${process.env.RUST_LOG}`);
}

if (values["firezone-name"] === "crash") {
  setTimeout(() => process.exit(42), 1000);
}

setInterval(() => {}, 1000);
