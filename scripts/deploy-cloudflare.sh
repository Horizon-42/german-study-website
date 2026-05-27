#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Deploy the Vite build to Cloudflare Pages.

Usage:
  npm run deploy:cloudflare
  npm run deploy:cloudflare -- <project-name> [branch]

Environment:
  CLOUDFLARE_PROJECT_NAME  Cloudflare Pages project name. Defaults to package.json name.
  CLOUDFLARE_BRANCH        Deployment branch. Defaults to current git branch, then main.
  CLOUDFLARE_OUTPUT_DIR    Build output directory. Defaults to dist.
  CLOUDFLARE_API_TOKEN     Optional non-interactive Wrangler auth token.

Examples:
  npm run deploy:cloudflare
  npm run deploy:cloudflare -- german-study-website main
  CLOUDFLARE_PROJECT_NAME=german-study-website CLOUDFLARE_BRANCH=main npm run deploy:cloudflare
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

default_project_name() {
  node -e 'const fs = require("fs"); const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")); process.stdout.write(pkg.name || "german-study-website");'
}

default_branch_name() {
  git rev-parse --abbrev-ref HEAD 2>/dev/null || printf '%s' "main"
}

PROJECT_NAME="${1:-${CLOUDFLARE_PROJECT_NAME:-$(default_project_name)}}"
BRANCH_NAME="${2:-${CLOUDFLARE_BRANCH:-$(default_branch_name)}}"
OUTPUT_DIR="${CLOUDFLARE_OUTPUT_DIR:-dist}"

if [[ -z "$PROJECT_NAME" ]]; then
  echo "Cloudflare project name is required."
  usage
  exit 1
fi

if [[ -x "./node_modules/.bin/wrangler" ]]; then
  WRANGLER=(./node_modules/.bin/wrangler)
else
  WRANGLER=(npx --yes wrangler@latest)
fi

echo "Building site..."
npm run build

if [[ ! -d "$OUTPUT_DIR" ]]; then
  echo "Build output directory '$OUTPUT_DIR' was not found."
  exit 1
fi

echo "Checking Cloudflare authentication..."
if ! "${WRANGLER[@]}" whoami >/dev/null 2>&1; then
  cat <<'AUTH'
Wrangler is not authenticated.

Run one of these, then retry:
  npx wrangler login
  export CLOUDFLARE_API_TOKEN=<token-with-pages-edit-access>
AUTH
  exit 1
fi

echo "Deploying '$OUTPUT_DIR' to Cloudflare Pages project '$PROJECT_NAME' on branch '$BRANCH_NAME'..."
"${WRANGLER[@]}" pages deploy "$OUTPUT_DIR" \
  --project-name "$PROJECT_NAME" \
  --branch "$BRANCH_NAME"
