import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import {
  cleanup,
  command,
  instance,
  preflight,
  prepare,
  start,
} from "../src/action.js";

await preflight();

async function fixture(mode, run) {
  const state = instance();
  await mkdir(state.directory, { mode: 0o700 });
  await writeFile(state.log, "", { mode: 0o600 });

  try {
    await prepare(
      state,
      path.resolve("test/fixtures/client.cjs"),
      "fixture-token",
    );

    await run(state, { seconds: 2, name: mode, logFilter: "debug" });
  } finally {
    await cleanup(state);
  }
}

test("systemd readiness, graceful stop, credential removal, and repeated cleanup", async () => {
  await fixture("CI % $HOME", async (state, config) => {
    await start(state, config);
    assert.equal(
      (await command("systemctl", ["is-active", state.unit])).stdout,
      "active",
    );

    process.env.STATE_instance = state.id;
    process.env.STATE_started = "true";

    try {
      await command(process.execPath, ["src/post.js"]);
    } finally {
      delete process.env.STATE_instance;
      delete process.env.STATE_started;
    }

    assert.match(await readFile(state.log, "utf8"), /ready CI % \$HOME/);
    assert.match(await readFile(state.log, "utf8"), /graceful shutdown/);
    assert.match(await readFile(state.log, "utf8"), /log filter debug/);
    assert.notEqual(
      (
        await command("sudo", ["-n", "test", "-e", state.root], {
          allowFailure: true,
        })
      ).code,
      0,
    );

    await cleanup(state, { checkAlive: true });
  });
});

test("a process that never signals readiness times out", async () => {
  await fixture("timeout", async (state, config) => {
    await assert.rejects(start(state, config), /failed/);
  });
});

test("an unexpected exit fails cleanup and still removes credentials", async () => {
  await fixture("crash", async (state, config) => {
    await start(state, config);
    await setTimeout(1500);

    await assert.rejects(
      cleanup(state, { checkAlive: true }),
      /stopped unexpectedly/,
    );
    assert.notEqual(
      (
        await command("sudo", ["-n", "test", "-e", state.root], {
          allowFailure: true,
        })
      ).code,
      0,
    );
  });
});
