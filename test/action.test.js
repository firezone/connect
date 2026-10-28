import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import {
  clientVersions,
  fileCommand,
  inputs,
  instance,
  releaseAsset,
  verifyAndSave,
} from "../src/action.js";

const valid = { INPUT_TOKEN: "test-token" };

test("validates supported versions, names, log filters, and bounded timeouts", () => {
  assert.ok(Object.hasOwn(clientVersions, inputs(valid).version));
  assert.equal(inputs(valid).logFilter, "info");
  assert.equal(
    inputs({ ...valid, "INPUT_LOG-FILTER": "debug,connlib=trace" }).logFilter,
    "debug,connlib=trace",
  );
  assert.equal(
    inputs({ ...valid, "INPUT_CONNECT-TIMEOUT": "2m" }).seconds,
    120,
  );

  for (const extra of [
    { INPUT_TOKEN: "" },
    { INPUT_TOKEN: "bad\ntoken" },
    { "INPUT_CLIENT-VERSION": "latest" },
    { "INPUT_CLIENT-VERSION": "../escape" },
    { "INPUT_CLIENT-VERSION": "1.6.0" },
    { "INPUT_CONNECT-TIMEOUT": "0s" },
    { "INPUT_CONNECT-TIMEOUT": "601s" },
    { INPUT_NAME: "bad\nname" },
    { "INPUT_LOG-FILTER": "bad\nfilter" },
  ])
    assert.throws(() => inputs({ ...valid, ...extra }));
});

test("runtime directories and release assets are validated", () => {
  const state = instance("12345678-1234-1234-1234-123456789012", "/tmp");

  assert.match(state.root, /^\/run\/setup-firezone-/);
  assert.throws(() => instance("../../etc", "/tmp"));
  assert.throws(() => instance(undefined, "relative"));
  assert.throws(() => releaseAsset("../version", "x86_64"));
  assert.throws(() => releaseAsset("1.5.14", "../../file"));
  assert.throws(() => releaseAsset("1.6.0", "x86_64"));
  assert.equal(
    releaseAsset("1.5.14", "x86_64").digest,
    clientVersions["1.5.14"].x86_64,
  );
});

test("verifies streamed bytes and deletes a binary with the wrong digest", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "setup-firezone-test-"),
  );
  const bytes = Buffer.from("test binary");
  const digest = createHash("sha256").update(bytes).digest("hex");

  try {
    await verifyAndSave(
      Readable.from([bytes]),
      digest,
      path.join(directory, "valid"),
    );
    assert.deepEqual(await readFile(path.join(directory, "valid")), bytes);

    await assert.rejects(
      verifyAndSave(
        Readable.from([bytes]),
        "0".repeat(64),
        path.join(directory, "bad"),
      ),
      /SHA-256/,
    );
    await assert.rejects(readFile(path.join(directory, "bad")), {
      code: "ENOENT",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("workflow file commands safely delimit multiline values", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "setup-firezone-test-"),
  );
  const file = path.join(directory, "output");

  try {
    await fileCommand(file, "value", "first\nsecond");
    const lines = (await readFile(file, "utf8")).trim().split("\n");

    assert.equal(lines[0], `value<<${lines.at(-1)}`);
    assert.equal(lines.slice(1, -1).join("\n"), "first\nsecond");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
