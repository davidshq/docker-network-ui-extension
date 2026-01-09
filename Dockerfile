# syntax=docker/dockerfile:1
# Build stage: compile the React/TypeScript UI
FROM node:20-alpine AS build
WORKDIR /app
COPY ui/package.json ui/package-lock.json* ui/pnpm-lock.yaml* ui/yarn.lock* ./ui/
RUN cd ui && (npm ci || npm install)
COPY ui ./ui
RUN cd ui && npm run build

# Final stage: minimal image with just the UI files and metadata
# Docker Desktop extracts files from /ui and serves them statically (no runtime needed)
FROM scratch

LABEL org.opencontainers.image.title="docker-network-ui" \
      org.opencontainers.image.description="Containers-like UI for managing Docker networks in Docker Desktop" \
      org.opencontainers.image.vendor="Docker Inc." \
      com.docker.desktop.extension.api.version="0.3.0" \
      com.docker.desktop.extension.icon="file:///icon.svg" \
      com.docker.extension.categories="utilities" \
      com.docker.extension.changelog="Initial release" \
      com.docker.extension.detailed-description="A Docker Desktop extension that provides a Containers-like UI for managing Docker networks. Features include listing and searching networks, inspecting network details, creating and removing networks, connecting and disconnecting containers, and pruning unused networks." \
      com.docker.extension.publisher-url="https://github.com" \
      com.docker.extension.screenshots="[]" \
      com.docker.extension.additional-urls=""

# Copy UI files to /ui (Docker Desktop extracts these and serves statically)
COPY --from=build /app/ui/dist /ui

# Copy extension metadata and assets
COPY metadata.json /metadata.json
COPY assets/icon.svg /icon.svg