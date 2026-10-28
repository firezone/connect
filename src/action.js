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
  "1.4.8": {
    x86_64: "fb22b7cb9c1f3678720ee931b6e42d3108ab084dfe070ee1bcb8bdd8cd30a3e2",
    aarch64: "6f68b7f1acaf237b4b182bcca473945fafc18a502a343f718cf257ba3e5c5548",
  },
  "1.4.7": {
    x86_64: "893b363e914786a2d8895e06118a9786a5d312f4bedee53a23d2435945302c5c",
    aarch64: "1972023b16ab552d8966a3ff4b2cd355ac1065711caeb4e516a96625554dde49",
  },
  "1.4.6": {
    x86_64: "28b66ed3307da616031f9cf2e301d87851407076cbc95d96501927fe1f17bd1a",
    aarch64: "9ed3a20f3ce522e8508fad70cd80cd6215d3d53bd6a929eb65f2782d830f2638",
  },
  "1.4.5": {
    x86_64: "27d041c2c44c07ffd7f18ec2badfd0cb50c4ac15b5b6ea23e9935b90d3cd1a13",
    aarch64: "281bce976be4b3c938a1e2616f336433036c42cee5c76bf3da4ac5ebe1db15fb",
  },
  "1.4.4": {
    x86_64: "b70057ac29daacd6899c0078fcdf8517cd921db6a9eaa12a4db61f4447fe587a",
    aarch64: "851b95d01d2380ec63582c7a95f87a42f7c5b99a4da44cbaf8862a154471f013",
  },
  "1.4.3": {
    x86_64: "85c3ad71ff6fc8f29321f19e2918dac68745e2d191d671aa11d277fe31e5e6de",
    aarch64: "6d2f1a5c4282a211149819638649e4c2bc090ca52b3faee3cb1e920c03254b12",
  },
  "1.4.2": {
    x86_64: "0a3e7f13c44ed6e09da624f9eff78a90fa847f48174be07ef1482f71cb6fd7cc",
    aarch64: "ba2b704f7609e053b6eda11370dd25acb34ba65ca29a4f79b5beff50a96ef9f9",
  },
  "1.4.1": {
    x86_64: "3db66fc6097088bf71e18d5d5cc6fe4f2d55c75a74677c4c7fced9e121126eb2",
    aarch64: "82800d54f4cf03ba22dfb37706e41c12180af5208722dd994400ef040c7be634",
  },
  "1.4.0": {
    x86_64: "f0b5e64e07249ffc3286c90b7a746ef62423628c4ccd8c5f07a68f9495bf49e0",
    aarch64: "cc8979cc82feff1541c0302bc36b8ed157e302b8e5baa212f5c6e99e33cc1b01",
  },
  "1.3.7": {
    x86_64: "7790b923f852a4b2603f998cba0b857f3ca61ddc4b9470f7947cbc665822ae4f",
    aarch64: "8373f2a0705c842331147f5d641bbb649ad368961b3e6ade78f9578fafcce1d7",
  },
  "1.3.6": {
    x86_64: "b08c0b87fd745f1a41a4b5c0ae05450379d980437f603fd85939979a6383354b",
    aarch64: "a3b59a24d999dc14450b329e38262235dc9babd83f8b1cf07d49f49ae9697b93",
  },
  "1.3.5": {
    x86_64: "39fd9435a74000de8566ffe1fdbe1070d95a3a65b1505912fba6fb7f1a5aab12",
    aarch64: "a82c6b3102c799983c31aa44451e250a1dd96dcbd17fcf17e51a62048c206565",
  },
  "1.3.4": {
    x86_64: "ccdac9a8ac7dbad7a7ba1cee0513c293a9b37be1a280d84d5e2cd52625ae4624",
    aarch64: "b4cdcc799a6d9d064a1c58b197023c8f2662546097cebfbe38c7f705568d2fc3",
  },
  "1.3.3": {
    x86_64: "44e7a4aeedc3cef2f862c8a473acc58cf83e04c3cbb28c08ff8bc14ae574a11a",
    aarch64: "2e367ef43ee6c0c3e4ccac91aa8e1941807bc32b5598bc62374241d9526b18b6",
  },
  "1.3.2": {
    x86_64: "b5cd7339a30c4e08f4e20d7b4f191c1bf4afc53d40915260c56f33dfc15efa24",
    aarch64: "6077d6dc32db7ed5e36e5ba3c19480c2e0047140329d8c7bc023ce02ad1e7343",
  },
  "1.3.1": {
    x86_64: "35b767433978fb2603bc78594bd5e4c14f868260843221309f30ba800d994d40",
    aarch64: "802890b27b1d2720bad9feecb0770dcc0ef72f31956508871dd6a732bac0d79a",
  },
  "1.3.0": {
    x86_64: "bbd29b40cd8e0810ba90cfb9f802cb6b43eb757328c5439cef77df2ae571de1e",
    aarch64: "9b380baa5eeb5dc7cfbfede5b4d8f6c01a8ce4e45c32a49995428f781fe62acf",
  },
  "1.2.0": {
    x86_64: "95b36c721f663377b9900b1091d6f24a44d6099f78448a548b26f7702da11dde",
    aarch64: "7eb5126486d4b621b20328a30e454aa2d630080de3e9e306117491473ed58daa",
  },
  "1.1.7": {
    x86_64: "2d8a8cd3f4e82d0b0d60a7dda3f92af9d1c81f6d561d170aef1f4e32df209141",
    aarch64: "5e2cad0239bea9b88d2dd2aa4bb12e5d5ea727a57e6e4f34dc710a36495d4d39",
  },
  "1.1.6": {
    x86_64: "d4b547a35f1a434f6be012832c91ca5e299460f6a56a53b4a463914b168317ae",
    aarch64: "a29a93cc26187265b30fceff46457044088128814bb80972f6ec9953deab7b0a",
  },
  "1.1.5": {
    x86_64: "85e9dfe36339f1618846d319c6f522f96798cb7246a1b297361471781687761e",
    aarch64: "b247ac1c611195f2e2137d0d6446bf3f843864caac9d8a0a117cec241c4fc7d8",
  },
  "1.1.4": {
    x86_64: "c63172f82dca57f9c78a1623d35a0d75fd66a2a85657751bb779aaf0e0c46583",
    aarch64: "c05585aa00c939b2bdfe277b18dab13e73729b4d35b9fd71aa5a35919cd7bd89",
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
