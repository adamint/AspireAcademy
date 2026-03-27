#!/usr/bin/env bash
set -euo pipefail

# Aspire Academy — Release Script
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 1.4.0
#
# This script:
#   1. Validates the version format (semver)
#   2. Checks that changelog.ts has an entry for this version
#   3. Runs backend tests
#   4. Runs frontend type-check and lint
#   5. Tags the commit and pushes the tag (triggers the release workflow)

VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 1.4.0"
  exit 1
fi

# Validate semver format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Version must be semver (e.g. 1.4.0), got: $VERSION"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHANGELOG="$REPO_ROOT/AspireAcademy.Web/src/data/changelog.ts"

# Check changelog has an entry for this version
if ! grep -q "version: '$VERSION'" "$CHANGELOG"; then
  echo "Error: No changelog entry found for version $VERSION"
  echo ""
  echo "Add an entry to AspireAcademy.Web/src/data/changelog.ts before releasing."
  echo "The entry should look like:"
  echo ""
  echo "  {"
  echo "    version: '$VERSION',"
  echo "    date: '$(date +%Y-%m-%d)',"
  echo "    title: '...',"
  echo "    highlights: [...],"
  echo "    entries: [...]"
  echo "  },"
  echo ""
  exit 1
fi

echo "✓ Changelog entry found for v$VERSION"

# Check for uncommitted changes
if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  echo "Error: You have uncommitted changes. Commit or stash them first."
  git -C "$REPO_ROOT" status --short
  exit 1
fi

echo "✓ Working tree is clean"

# Run backend tests
echo ""
echo "Running backend tests..."
dotnet test "$REPO_ROOT/AspireAcademy.Api.Tests/" --filter 'FullyQualifiedName!~E2E' --verbosity quiet
echo "✓ Backend tests passed"

# Run frontend checks
echo ""
echo "Running frontend type-check and lint..."
(cd "$REPO_ROOT/AspireAcademy.Web" && npm run type-check && npm run lint)
echo "✓ Frontend checks passed"

# Tag and push
echo ""
echo "Creating tag v$VERSION..."
git -C "$REPO_ROOT" tag -a "v$VERSION" -m "Release v$VERSION"
git -C "$REPO_ROOT" push origin main
git -C "$REPO_ROOT" push origin "v$VERSION"

echo ""
echo "✓ Release v$VERSION tagged and pushed!"
echo "  GitHub Actions will now run the release workflow."
echo "  After it passes, run 'aspire deploy' from the repo root to deploy to Azure."
