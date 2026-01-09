# Docker Desktop Extension: Networks UI

Yeah...It doesn't do most of the below yet...forthcoming.

And using Agentic AI...so code quality is...

A Docker Desktop extension that provides a **Containers-like UI for Docker Networks**:
- List + search networks
- Inspect network (drawer)
- Create / remove networks
- Connect / disconnect containers
- Prune unused networks

## Prereqs
- Docker Desktop with Extensions enabled
- Node.js (only for local UI dev)

## Build & Install (recommended)
From this repo root:

```bash
docker extension build .
docker extension install .
```

Then open Docker Desktop → Extensions → **Networks UI**.

## Local UI dev (optional)
```bash
cd ui
npm install
npm run dev
```

> For dev mode inside Docker Desktop you typically follow the Extensions docs workflow for hot reload.
> This repository is designed to work with `docker extension build/install` out of the box.

## Notes
The UI calls Docker CLI via `ddClient.docker.cli.exec(...)` (no backend service required).
