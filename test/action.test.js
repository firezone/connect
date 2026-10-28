import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  command,
  downloadClient,
  fileCommand,
  inputs,
  instance,
  pinned,
  releaseAsset,
  response,
} from "../src/action.js";

const valid = { INPUT_TOKEN: "test-token" };

test("validates exact versions, digests, names, and bounded timeouts", () => {
  assert.equal(inputs(valid).version, pinned.version);
  assert.equal(
    inputs({ ...valid, "INPUT_CONNECT-TIMEOUT": "2m" }).seconds,
    120,
  );
  for (const extra of [
    { INPUT_TOKEN: "" },
    { INPUT_TOKEN: "bad\ntoken" },
    { "INPUT_CLIENT-VERSION": "latest" },
    { "INPUT_CLIENT-VERSION": "../escape" },
    { "INPUT_CLIENT-SHA256": "not-a-digest" },
    { "INPUT_CONNECT-TIMEOUT": "0s" },
    { "INPUT_CONNECT-TIMEOUT": "601s" },
    { INPUT_NAME: "bad\nname" },
  ])
    assert.throws(() => inputs({ ...valid, ...extra }));
});

test("runtime directories cannot be selected through path traversal", () => {
  const state = instance("12345678-1234-1234-1234-123456789012", "/tmp");
  assert.match(state.root, /^\/run\/setup-firezone-/);
  assert.throws(() => instance("../../etc", "/tmp"));
  assert.throws(() => instance(undefined, "relative"));
  assert.throws(() => releaseAsset("../version", "x86_64"));
  assert.throws(() => releaseAsset("1.2.3", "../../file"));
});

test("child processes receive a token only through stdin", async () => {
  const old = {
    input: process.env.INPUT_TOKEN,
    token: process.env.FIREZONE_TOKEN,
  };
  process.env.INPUT_TOKEN = "secret-input";
  process.env.FIREZONE_TOKEN = "unrelated-secret";
  try {
    const result = await command(
      process.execPath,
      [
        "-e",
        `
      let data = '';
      process.stdin.on('data', (chunk) => data += chunk);
      process.stdin.on('end', () => console.log(JSON.stringify({
        input: process.env.INPUT_TOKEN, token: process.env.FIREZONE_TOKEN, received: data.length
      })));
    `,
      ],
      { input: "secret-input" },
    );
    assert.deepEqual(JSON.parse(result.stdout), { received: 12 });
  } finally {
    for (const [key, value] of [
      ["INPUT_TOKEN", old.input],
      ["FIREZONE_TOKEN", old.token],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("rejects HTTPS redirects to other domains or plaintext HTTP", async () => {
  const original = globalThis.fetch;
  try {
    for (const target of [
      "http://github.com/asset",
      "https://example.com/asset",
    ]) {
      globalThis.fetch = async () =>
        new Response(null, { status: 302, headers: { location: target } });
      await assert.rejects(
        response("https://github.com/asset", 4096),
        /outside GitHub HTTPS/,
      );
    }
    globalThis.fetch = async () =>
      new Response(null, { status: 302, headers: { location: "/again" } });
    await assert.rejects(
      response("https://github.com/asset", 4096),
      /Too many/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("verifies downloaded bytes and deletes a binary with the wrong digest", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "setup-firezone-test-"),
  );
  const original = globalThis.fetch;
  const bytes = Buffer.from("test binary");
  const digest = createHash("sha256").update(bytes).digest("hex");
  try {
    globalThis.fetch = async () => new Response(bytes);
    await downloadClient(
      "1.5.14",
      "x86_64",
      digest,
      path.join(directory, "valid"),
    );
    assert.deepEqual(await readFile(path.join(directory, "valid")), bytes);
    await assert.rejects(
      downloadClient(
        "1.5.14",
        "x86_64",
        "0".repeat(64),
        path.join(directory, "bad"),
      ),
      /SHA-256/,
    );
    await assert.rejects(readFile(path.join(directory, "bad")), {
      code: "ENOENT",
    });
    globalThis.fetch = async () =>
      new Response(bytes, { headers: { "content-length": "999999999" } });
    await assert.rejects(
      downloadClient("1.5.14", "x86_64", digest, path.join(directory, "large")),
      /size limit/,
    );
  } finally {
    globalThis.fetch = original;
    await rm(directory, { recursive: true, force: true });
  }
});

test("version overrides require a checksum naming the selected asset", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "setup-firezone-test-"),
  );
  const original = globalThis.fetch;
  const bytes = Buffer.from("override binary");
  const digest = createHash("sha256").update(bytes).digest("hex");
  try {
    globalThis.fetch = async (url) =>
      new Response(url.endsWith(".txt") ? `${digest}  wrong-name\n` : bytes);
    await assert.rejects(
      downloadClient("1.6.0", "x86_64", "", path.join(directory, "bad")),
      /selected asset/,
    );
    globalThis.fetch = async (url) =>
      new Response(
        url.endsWith(".txt")
          ? `${digest}  firezone-client-headless-linux_1.6.0_x86_64\n`
          : bytes,
      );
    await downloadClient("1.6.0", "x86_64", "", path.join(directory, "valid"));
  } finally {
    globalThis.fetch = original;
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
