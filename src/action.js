import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  access,
  appendFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export const clientVersions = {
  "1.5.14": {
    x86_64: "61e8445a7d8550ff4cd7bac1904b13ad38ecbdd336b4db46f97087eae7865519",
    aarch64: "3ca8df337b022149d48edeb3449f166cfa9585310a7e246e764b794b59f3fa86",
  },
  "1.5.13": {
    x86_64: "d4a054db8364f2f7a57217c892b55b41d9a6a3971a31412f33aeec653e10aa41",
    aarch64: "7a61e3e271120eba262aebbd4381545e921b2a25aedd81ee4fab379dc0a5ea7a",
  },
  "1.5.12": {
    x86_64: "d92f79cca61d5a9c5ac500dd1311b761f52643d9b5974409adb0d2f0670c06ce",
    aarch64: "d2afbd9cf4e99bc5f4718a2f48bbbe2b52976c6a17c4b65027cc44fcc635910d",
  },
  "1.5.11": {
    x86_64: "0339e7e0fc44c578c04345e3073279524b02e4966804114dd8699b56bd457635",
    aarch64: "5039b1bfaf281f970c22f2d22f5be96524e4b3a6d949cedacdb96ed8de39720a",
  },
  "1.5.10": {
    x86_64: "99a96be93f320a35cf326e7a55feed3829a388ef3a1402a7fcab5a5d4aa35726",
    aarch64: "7340da579e46988245538686222faee7cd624e4ce019b1c3cb5f002f1b66ec1d",
  },
  "1.5.9": {
    x86_64: "ef53b1897aebc634dd340aa8c5ba25fb813ef6bc996c58c0915ef32ce24d09e0",
    aarch64: "3e6b05ef584e0c7c0f7a9428d3b5e580d5bc226c2f1cffb6edb4f3f89966926d",
  },
  "1.5.8": {
    x86_64: "9759f21f58ed19fefabcc67226adf99eebe5f669eebe7a442ad9283b3dc994ca",
    aarch64: "19ff661e2946ad0f1fcb8d8555e052f0dd27ad70e5cd08970c88b669558c826a",
  },
  "1.5.7": {
    x86_64: "1b0bab4e88751a42b7cf1c7ce083a8eefe4d608e27c207fdee130557abb81329",
    aarch64: "8d84bdb303d31b2bfbad1b1f532cd55ec54073646683f7ced78949ad621ad8f0",
  },
  "1.5.6": {
    x86_64: "489d67fecaa8bd1e622e528dfa1a9ba84d7ae5f552fa926cf8034365cc729889",
    aarch64: "554b72189ef460267080de1305359c816f7e46b298013a554b818a95b9fc08f2",
  },
  "1.5.5": {
    x86_64: "4af81ac5152074c249b90e4fa452fe1f30562334e036b5a293d96c65c60ca759",
    aarch64: "1b18426358ff61e4c24db8d6b856d4d1f840e64cec81ec52efb6414371b31cbb",
  },
  "1.5.4": {
    x86_64: "1b4474907ae80fcb23209191593c676c945f447c8a8ca7181ba3c9fb06bfd186",
    aarch64: "edd3132cfb5bd4dabc682304b673ed90789cc856e90f10290d70842715fa69b5",
  },
  "1.5.3": {
    x86_64: "cf01b9d66b040803b494f7b744cb303612b6fb8ed4be69052b3f80aae149373f",
    aarch64: "e0acbfa33a83a511c1d4b18c08fad925da9323e49cd392988891c74b078c61b8",
  },
  "1.5.2": {
    x86_64: "bd0a627321351a0ac84da3ab0da74760c85b1f08fca06acf5df8338faf92eb1d",
    aarch64: "bb42609e0509be0c404c4a7b0c4bcb31b86f5a596eb82006b21187b3f269ec75",
  },
  "1.5.1": {
    x86_64: "c4e1d99356364f9a172d1ace2b371c2955fb2d0d256decfeb6a103b5809aad21",
    aarch64: "cd1d08c6b9cfe189909c332b4f0b96e87255e00a3709ac87d0beab43cbfa200f",
  },
  "1.5.0": {
    x86_64: "1ad0d9f831c0c20fafe752040faee62deb3e2872cc096af785d1cb256533568e",
    aarch64: "5207ea291ffdee1d8141f175ae64b128567c46058ed2923f3df99d031266d605",
  },
};

export function mask(secret) {
  process.stdout.write(`::add-mask::${escapeCommand(secret)}\n`);
}

function escapeCommand(value) {
  return String(value)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

export async function fileCommand(file, key, value) {
  if (!file) throw new Error("This action must run inside GitHub Actions.");
  const delimiter = randomUUID();

  await appendFile(file, `${key}<<${delimiter}\n${value}\n${delimiter}\n`);
}

export function inputs(env = process.env) {
  const token = env.INPUT_TOKEN || "";
  if (!token.trim() || /[\r\n\0]/.test(token))
    throw new Error("A nonempty, single-line token is required.");

  const version = env["INPUT_CLIENT-VERSION"] || "1.5.14";
  if (!Object.hasOwn(clientVersions, version))
    throw new Error(`Unsupported client-version: ${version}.`);

  const timeout = env["INPUT_CONNECT-TIMEOUT"] || "60s";
  if (!/^[1-9]\d*(s|m)$/.test(timeout))
    throw new Error(
      "connect-timeout must be a positive integer followed by s or m.",
    );

  const seconds =
    Number(timeout.slice(0, -1)) * (timeout.endsWith("m") ? 60 : 1);
  if (!Number.isSafeInteger(seconds) || seconds > 600)
    throw new Error("connect-timeout must be at most 10m.");

  const name =
    env.INPUT_NAME ||
    `${env.GITHUB_REPOSITORY}/${env.GITHUB_JOB}/${env.GITHUB_RUN_ID}/${env.GITHUB_RUN_ATTEMPT}`;
  if (name.length > 255 || /[\r\n\0]/.test(name))
    throw new Error("name must be a single line of at most 255 characters.");

  const logFilter = env["INPUT_LOG-FILTER"] || "info";
  if (/[\r\n\0]/.test(logFilter))
    throw new Error("log-filter must be a single line.");

  return { token, version, seconds, name, logFilter };
}

export function command(
  program,
  args,
  { input, timeout = 30_000, allowFailure = false } = {},
) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.INPUT_TOKEN;
    delete env.FIREZONE_TOKEN;

    const child = spawn(program, args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);

    child.stdout.on("data", (data) => {
      stdout = (stdout + data).slice(-1_048_576);
    });
    child.stderr.on("data", (data) => {
      stderr = (stderr + data).slice(-1_048_576);
    });
    child.stdin.on("error", () => {});

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const result = { code, stdout: stdout.trim(), stderr: stderr.trim() };
      if (code === 0 || allowFailure) resolve(result);
      else
        reject(
          new Error(`${program} failed (${signal || code}): ${stderr.trim()}`),
        );
    });

    child.stdin.end(input);
  });
}

export async function preflight() {
  if (
    process.platform !== "linux" ||
    !["x64", "arm64"].includes(process.arch) ||
    process.env.RUNNER_ENVIRONMENT !== "github-hosted"
  ) {
    throw new Error(
      "Only GitHub-hosted Ubuntu 24.04 x86-64 and ARM64 virtual machines are supported.",
    );
  }

  const os = await readFile("/etc/os-release", "utf8");
  if (!/^ID=ubuntu$/m.test(os) || !/^VERSION_ID="24\.04"$/m.test(os))
    throw new Error("Ubuntu 24.04 is required.");

  await access("/run/systemd/system");
  await access("/dev/net/tun");
  await command("sudo", ["-n", "true"]);
  await command("systemctl", ["is-active", "--quiet", "systemd-resolved"]);

  const links = JSON.parse(
    (await command("ip", ["-json", "link", "show"])).stdout,
  );
  if (links.some((link) => link.ifname === "tun-firezone"))
    throw new Error("A Firezone tunnel already exists on this runner.");

  const existing = (
    await command("systemctl", [
      "list-units",
      "--state=activating,active",
      "--plain",
      "--no-legend",
      "firezone*.service",
    ])
  ).stdout;
  if (existing)
    throw new Error("A Firezone service is already running on this runner.");

  const units = (
    await command("systemctl", [
      "list-units",
      "--all",
      "--plain",
      "--no-legend",
      "setup-firezone-*.service",
    ])
  ).stdout;
  if (units)
    throw new Error(
      "This job already has a setup-firezone invocation. Only one is supported.",
    );

  return process.arch === "x64" ? "x86_64" : "aarch64";
}

export async function response(url, maxBytes) {
  for (let redirects = 0; redirects <= 5; redirects++) {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      !(
        parsed.hostname === "github.com" ||
        parsed.hostname.endsWith(".githubusercontent.com")
      )
    ) {
      throw new Error(
        "Refusing a download outside GitHub HTTPS release storage.",
      );
    }

    const result = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(120_000),
    });

    if ([301, 302, 303, 307, 308].includes(result.status)) {
      await result.body?.cancel();
      url = new URL(result.headers.get("location"), url).href;
      continue;
    }

    if (!result.ok || !result.body)
      throw new Error(`Release download failed with HTTP ${result.status}.`);

    if (Number(result.headers.get("content-length")) > maxBytes) {
      await result.body.cancel();
      throw new Error("Release download exceeds the size limit.");
    }

    return result;
  }

  throw new Error("Too many release download redirects.");
}

export function releaseAsset(version, arch) {
  const digest = clientVersions[version]?.[arch];
  if (!/^[a-f0-9]{64}$/.test(digest))
    throw new Error(`Unsupported client release: ${version}/${arch}.`);

  const name = `firezone-client-headless-linux_${version}_${arch}`;
  return {
    url: `https://github.com/firezone/firezone/releases/download/headless-client-${version}/${name}`,
    digest,
  };
}

export async function downloadClient(version, arch, destination) {
  const { url, digest } = releaseAsset(version, arch);
  const binary = await response(url, 128 * 1024 * 1024);

  await verifyAndSave(Readable.fromWeb(binary.body), digest, destination);
}

export async function verifyAndSave(readable, expectedDigest, destination) {
  let bytes = 0;
  const hash = createHash("sha256");

  await pipeline(
    readable,
    new Transform({
      transform(chunk, encoding, callback) {
        bytes += chunk.length;
        if (bytes > 128 * 1024 * 1024)
          return callback(new Error("Client binary exceeds the size limit."));

        hash.update(chunk);
        callback(null, chunk);
      },
    }),
    createWriteStream(destination, { flags: "wx", mode: 0o700 }),
  );

  if (hash.digest("hex") !== expectedDigest) {
    await rm(destination, { force: true });
    throw new Error("Client binary SHA-256 verification failed.");
  }
}

export function instance(id = randomUUID(), temp = process.env.RUNNER_TEMP) {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      id,
    ) ||
    !temp ||
    !path.isAbsolute(temp)
  )
    throw new Error("Invalid action runtime directory.");

  const directory = path.join(temp, `setup-firezone-${id}`);
  const root = `/run/setup-firezone-${id}`;

  return {
    id,
    directory,
    root,
    unit: `setup-firezone-${id}.service`,
    log: path.join(directory, "client.log"),
  };
}

export async function prepare(state, binary, token) {
  await command("sudo", ["-n", "install", "-d", "-m", "0700", state.root]);

  await command("sudo", [
    "-n",
    "install",
    "-m",
    "0755",
    binary,
    `${state.root}/client`,
  ]);

  await command(
    "sudo",
    ["-n", "sh", "-c", 'umask 077; cat > "$1"', "sh", `${state.root}/token`],
    { input: token },
  );
}

export async function start(state, { seconds, name, logFilter }) {
  await command(
    "sudo",
    [
      "-n",
      "systemd-run",
      "--quiet",
      "--expand-environment=no",
      `--unit=${state.unit}`,
      "--property=Type=notify",
      "--property=NotifyAccess=main",
      `--property=TimeoutStartSec=${seconds}s`,
      "--property=TimeoutStopSec=15s",
      "--property=Restart=no",
      "--property=RuntimeMaxSec=21600s",
      `--property=StandardOutput=append:${state.log}`,
      `--property=StandardError=append:${state.log}`,
      `--setenv=RUST_LOG=${logFilter}`,
      `${state.root}/client`,
      `--token-path=${state.root}/token`,
      `--firezone-id=${state.id}`,
      `--firezone-name=${name}`,
    ],
    { timeout: (seconds + 20) * 1000 },
  );

  await command("systemctl", ["is-active", "--quiet", state.unit]);
}

export async function cleanup(state, { checkAlive = false } = {}) {
  const marker = path.join(state.directory, "cleaned");
  if (
    await access(marker).then(
      () => true,
      () => false,
    )
  )
    return;

  let unexpected = false;
  if (checkAlive)
    unexpected =
      (
        await command("systemctl", ["is-active", "--quiet", state.unit], {
          allowFailure: true,
        })
      ).code !== 0;

  const stopped = await command(
    "sudo",
    ["-n", "systemctl", "stop", state.unit],
    { allowFailure: true },
  );
  const status = await command(
    "systemctl",
    ["show", state.unit, "--property=ActiveState", "--value"],
    { allowFailure: true },
  );
  if (status.code === 0 && !["inactive", "failed", ""].includes(status.stdout))
    throw new Error(`Could not stop Firezone: ${stopped.stderr}`);

  await command("sudo", ["-n", "rm", "-rf", "--", state.root]);

  await command("sudo", ["-n", "systemctl", "reset-failed", state.unit], {
    allowFailure: true,
  });
  await rm(path.join(state.directory, "client"), { force: true });
  await writeFile(marker, "", { mode: 0o600 });

  if (unexpected)
    throw new Error(
      `Firezone stopped unexpectedly during the job. Inspect ${state.log}.`,
    );
}

export async function run() {
  const token = process.env.INPUT_TOKEN || "";
  if (token) mask(token);

  const config = inputs();
  delete process.env.INPUT_TOKEN;
  delete process.env.FIREZONE_TOKEN;

  const arch = await preflight();
  const state = instance();

  await fileCommand(process.env.GITHUB_STATE, "instance", state.id);
  await mkdir(state.directory, { mode: 0o700 });
  await writeFile(state.log, "", { mode: 0o600 });
  await fileCommand(process.env.GITHUB_OUTPUT, "log-path", state.log);

  try {
    const binary = path.join(state.directory, "client");
    await downloadClient(config.version, arch, binary);
    await prepare(state, binary, config.token);
    await start(state, config);

    await fileCommand(process.env.GITHUB_STATE, "started", "true");
    await fileCommand(
      process.env.GITHUB_OUTPUT,
      "client-version",
      config.version,
    );

    console.log(
      `Firezone ${config.version} is ready. Client logs: ${state.log}`,
    );
  } catch (error) {
    await cleanup(state).catch((cleanupError) =>
      console.error(cleanupError.message),
    );

    throw new Error(`${error.message} Client logs: ${state.log}`);
  }
}

export async function post() {
  if (!process.env.STATE_instance) return;

  const state = instance(process.env.STATE_instance);
  await cleanup(state, { checkAlive: process.env.STATE_started === "true" });
}
