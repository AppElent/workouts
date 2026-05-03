#!/usr/bin/env bash
set -e

IMAGE="ghcr.io/${REGISTRY_OWNER}/workouts"
VERSION="${npm_package_version}"
SHA=$(git rev-parse --short HEAD)
CREATED=$(date -u +%Y-%m-%dT%H:%M:%SZ)

docker build \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY}" \
  --build-arg VITE_CONVEX_URL="${VITE_CONVEX_URL}" \
  --label "org.opencontainers.image.title=workouts" \
  --label "org.opencontainers.image.version=${VERSION}" \
  --label "org.opencontainers.image.created=${CREATED}" \
  --label "org.opencontainers.image.revision=${SHA}" \
  --label "org.opencontainers.image.source=https://github.com/${REGISTRY_OWNER}/workouts" \
  -t "${IMAGE}:${VERSION}" \
  -t "${IMAGE}:latest" \
  .

echo "Built: ${IMAGE}:${VERSION} (${SHA})"
