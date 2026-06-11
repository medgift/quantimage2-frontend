# Reference docs

Long-form architecture and conventions for the QuantImage v2 **frontend**, split
by topic. These were recovered from the former `.github/copilot-instructions.md`
and reorganized so each file covers one area.

> **Reference, not contract.** These notes describe how the app is intended to
> work and may drift from the code. When it matters, verify against the actual
> source — the code is the source of truth. The lean, always-loaded rules live
> in [`../../CLAUDE.md`](../../CLAUDE.md); read these on demand.

| File | Covers |
| --- | --- |
| [architecture.md](architecture.md) | Project overview, data flow, services & dependencies (Backend / Kheops / Keycloak) |
| [code-structure.md](code-structure.md) | `src/` layout — services, context, config, utils, components |
| [page-components.md](page-components.md) | Top-level route pages and their responsibilities |
| [development-patterns.md](development-patterns.md) | Conventions and patterns for working in the codebase |
| [auth.md](auth.md) | Keycloak OIDC auth flow + security / medical-data handling |
| [feature-extraction.md](feature-extraction.md) | Feature extraction flow |
| [ml-modeling.md](ml-modeling.md) | Model training flow |
| [libraries.md](libraries.md) | Key libraries inventory |
| [gotchas.md](gotchas.md) | Important notes / non-obvious behaviors |
| [config.md](config.md) | Environment setup and `REACT_APP_*` env vars |
| [commands.md](commands.md) | Testing, useful commands, troubleshooting |
| [coding-standards.md](coding-standards.md) | Coding standards + post-edit code formatting |
| [docker-deployment.md](docker-deployment.md) | Docker, container networking, deployment commands |
