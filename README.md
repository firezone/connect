# Setup Firezone

Connect a GitHub Actions job to your [Firezone Resources](https://www.firezone.dev/kb/concepts/resources).

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

We recommend using a [service account](https://www.firezone.dev/kb/concepts/actors#service-accounts) for `FIREZONE_TOKEN` and keeping its access narrow.

## Supported runners

| GitHub-hosted runner | Architecture |
| -------------------- | ------------ |
| `ubuntu-24.04`       | x86-64       |
| `ubuntu-24.04-arm`   | ARM64        |

## Inputs and outputs

| Input             | Default                    | Description                                           |
| ----------------- | -------------------------- | ----------------------------------------------------- |
| `token`           | Required                   | Firezone service account token.                       |
| `client-version`  | `1.5.14`                   | Supported headless client version.                    |
| `connect-timeout` | `60s`                      | Positive integer followed by `s` or `m`, up to `10m`. |
| `log-filter`      | `info`                     | Rust log filter for the headless client.              |
| `name`            | Repository/job/run/attempt | Client display name, at most 255 characters.          |

| Output           | Description                                                    |
| ---------------- | -------------------------------------------------------------- |
| `client-version` | Installed client version.                                      |
| `log-path`       | Local client log file, retained until the runner is destroyed. |

Licensed under [Apache-2.0](LICENSE).
