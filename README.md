# Oclushion

Oclushion is an AI-native desktop IDE for real software projects. It turns a repository into an AI-ready workspace with structured context, role-based skillpacks, model routing, Safe Diff review, and privacy protection through the internal Sano Shield engine.

Sano is no longer the primary product in this repository. Its proven privacy technology now lives inside Oclushion as **Sano Shield**, the local protection layer that sanitizes prompts and repository context before they reach external AI providers.

## What Oclushion Provides

- **Desktop IDE shell**: a Tauri-based app with repository navigation, editor surface, AI panel, skillpacks, marketplace, audit view, and Safe Diff quarantine.
- **Intelligent Context Engine**: repository scanner, dependency graph, context packer, and token budget controls.
- **Skillpacks**: role-specific operating profiles for fullstack development, security auditing, database work, architecture, testing, and more.
- **Model Router**: provider abstraction for OpenAI-style, Anthropic-style, BYOK, and future local model workflows.
- **Sano Shield**: local sanitization and restoration pipeline for emails, secrets, API keys, tokens, payment data, and other sensitive values.
- **Safe Diff and command quarantine**: AI-generated code and shell commands require explicit human approval before they can affect the workspace.
- **Audit trail**: local activity logging with plan-aware sync behavior for Team and Enterprise workflows.
- **Marketplace**: verified Skills and AI Tools distributed from a remote catalog with SHA-256 integrity checks.

## Marketplace Security

Oclushion Marketplace installs project-local AI tools under `.oclushion-tools/`. This directory is intentionally ignored by Git, and the installer protects the project `.gitignore` before writing any tool file. Every downloaded Skill or AI Tool must match the SHA-256 checksum declared by the remote Marketplace catalog.

## Workspace Layout

```text
apps/
  browser-extension/        Optional browser protection companion
  control-api/              Control plane for auth, plans, metering, policies, audit, connectors
  desktop-shell/            Oclushion Tauri desktop IDE
  web/                      Public site and web dashboard surface

packages/
  agent-protect/            Safe workspace and command execution protections
  browser-protect/          Browser-side sanitization engine
  config/                   Shared TypeScript configuration
  connectors/               OAuth connector primitives and encrypted token handling
  policy-runtime/           Deterministic privacy policy evaluator
  sano-shield-data-gateway/ Data gateway boundary for structured data protection
  sano-shield-data-protect/ Structured data tokenization and masking
  sano-shield-pii-service/  Python PII detector service boundary
  sano-shield-proxy/        Fastify Sano Shield proxy boundary
  sano-shield-sdk/          Lightweight TypeScript integration SDK
  shared/                   Shared contracts and runtime schemas
```

Historical Sano implementation documents are archived under `Implementacion/Historico-Sano/`. Active Oclushion documentation lives under `Implementacion/Oclushion/`.

## Development

```bash
pnpm install
docker compose up -d
pnpm dev
```

Copy `.env.example` to `.env` before enabling services that require local infrastructure. The Docker topology starts PostgreSQL, Redis, the Sano Shield PII service, the Sano Shield proxy, and the structured data gateway for local development.

## Desktop Shell

```bash
pnpm --filter @oclushion/desktop-shell dev
pnpm --filter @oclushion/desktop-shell build
```

Native release packaging is wired through Tauri:

```bash
pnpm build:release
```

Windows native builds require the Microsoft C++ Build Tools linker toolchain. macOS and Linux builds require their respective platform SDKs and signing/notarization configuration.

## Tauri Updater Signing

Private test builds keep the Tauri updater disabled in `apps/desktop-shell/src-tauri/tauri.conf.json` so no executable ships with a placeholder signing key. Before a public desktop release, generate and store a real updater keypair in the release secret manager, publish the public key in the Tauri config, enable the updater endpoint, and sign every release artifact in CI:

```bash
pnpm --filter @oclushion/desktop-shell tauri signer generate -w ~/.oclushion/updater.key
pnpm --filter @oclushion/desktop-shell tauri build
```

The private key must never be committed. CI should expose it only as an encrypted secret during release signing.

## Validation

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The monorepo uses pnpm workspaces and Turborepo. Package names use the `@oclushion/*` namespace; Sano appears only as the internal Sano Shield privacy subsystem.
