# Setup Firezone

Connect a GitHub Actions job to your [Firezone Resources](https://www.firezone.dev/kb/concepts/resources).
The action downloads a verified headless client, waits for tunnel configuration, and stops the client at the end of the job.

This action is under development. There is no `v1` release yet. Use a reviewed commit SHA while evaluating it.

```yaml
jobs:
  integration-tests:
    runs-on: ubuntu-24.04
    steps:
      - uses: firezone/setup-firezone@main # Pin a reviewed full commit SHA.
        with:
          token: ${{ secrets.FIREZONE_TOKEN }}

      - name: Check private service
        run: curl --fail https://service.example.com/health
```

Create a [service account](https://www.firezone.dev/kb/concepts/actors#service-accounts), grant it access to the required Resources through a Group and Policy, and store its token as the `FIREZONE_TOKEN` repository or environment secret. Use a dedicated service account with only the access the job needs. Run steps receiving this token only with trusted code.

The action requires no GitHub API token or additional workflow permissions. The caller does not need to check out this repository.

## Supported runners

Use `ubuntu-24.04` or `ubuntu-24.04-arm` GitHub-hosted virtual machines. The runner must have systemd, systemd-resolved, `/dev/net/tun`, and passwordless sudo. Windows, macOS, container jobs, persistent self-hosted runners, and multiple Firezone clients on one runner are currently unsupported. A fresh device ID is generated for each invocation.

## Inputs and outputs

| Input             | Default                    | Description                                                 |
| ----------------- | -------------------------- | ----------------------------------------------------------- |
| `token`           | Required                   | Firezone service account token.                             |
| `client-version`  | `1.5.14`                   | Exact stable headless client version.                       |
| `client-sha256`   | See below                  | Expected SHA-256 of the binary for the runner architecture. |
| `connect-timeout` | `60s`                      | Positive integer followed by `s` or `m`, up to `10m`.       |
| `name`            | Repository/job/run/attempt | Client display name, at most 255 characters.                |

| Output           | Description                                                    |
| ---------------- | -------------------------------------------------------------- |
| `client-version` | Installed client version.                                      |
| `log-path`       | Local client log file, retained until the runner is destroyed. |

The default client has architecture-specific checksums embedded in the action source. Pinning the action's commit SHA also pins its default binary bytes. Explicit version overrides use that release's published checksum unless `client-sha256` is provided. Pin both the version and digest for reproducible overrides. When overriding the default version, the caller is responsible for compatibility with the documented client arguments and readiness notification.

## Readiness and cleanup

The client runs as a uniquely named transient systemd service with `Type=notify`. Setup succeeds after the client reports that tunnel addresses, DNS, and routes are configured. This does not prove an individual Resource or application is healthy; perform your own application check in the next step.

The service account token is written to a root-owned file with mode `0600`. It is never placed in command arguments, saved action state, or logs. The client does not restart automatically. If it exits unexpectedly during the job, post-job cleanup reports failure.

Startup failure triggers immediate cleanup. The post-job hook also runs after failed steps and requests cancellation cleanup. It stops the client gracefully so the client restores DNS and releases its tunnel, then deletes its credentials and binary. Cleanup is safe to repeat. Logs remain private to the runner and are never uploaded automatically. They may contain Resource names or addresses, so review them before sharing.

Forced runner termination can prevent cleanup. A six-hour service lifetime provides a backstop, and supported hosted runners are destroyed at job end. Stopping the client does not revoke the service account token or delete the device record from the Firezone portal.

## Development and validation

Node.js 24 is the only development dependency. There are no npm runtime dependencies or generated bundles.

```sh
npm run check
npm test
```

CI additionally runs `npm run test:systemd` on both supported architectures, checking service readiness, startup timeout, graceful shutdown, credential removal, repeated cleanup, and unexpected process exit. It also downloads the actual pinned client and checks cleanup after an invalid token fails startup.

Real Resource connectivity requires configuration. Create a protected GitHub environment named `integration`, add its `FIREZONE_TOKEN` secret and `FIREZONE_TEST_URL` variable pointing to a dedicated test Resource, and manually run the [Resource connectivity workflow](.github/workflows/connectivity.yml) on `main`. The workflow is not run on pull requests and does not provision or modify Firezone account resources. A successful run checks both supported architectures. Configure required reviewers on the environment when access needs approval.

## Releases

Action versions and client versions are independent. Action releases use SemVer:

- Patch: compatible fixes, dependency updates, and tested compatible client updates.
- Minor: new optional functionality.
- Major: changed input semantics, removed runner support, or another incompatible contract change.

To release, merge reviewed changes to `main`, verify the complete CI matrix and manually configured Resource connectivity workflow, then create an immutable patch release tag such as `v1.0.0` on that tested commit. Move the `v1` tag to that commit after validation. Never move a patch release tag. Publish the patch release to Marketplace when ready. Keep the major alias as a tag without a GitHub Release so immutable patch releases can coexist with it.

Recommend full commit SHA pins, with a version comment, for production callers. `@v1` receives compatible updates; `@main` is for development only. A new client release should produce a reviewed update of the default version and both binary checksums, with the same CI and connectivity checks before publishing. This repository does not automatically release or advance tags.

Licensed under [Apache-2.0](LICENSE).
