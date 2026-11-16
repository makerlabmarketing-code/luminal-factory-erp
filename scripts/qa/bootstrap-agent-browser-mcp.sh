#!/usr/bin/env bash
set -euo pipefail

# Runs only inside a trusted Codex/project environment, never on the user's PC by itself.
# This bootstraps an ephemeral MCP server; it does not authenticate to ChatGPT or ERP.
if ! command -v npx >/dev/null 2>&1; then
  echo 'Node.js/npx is required for Luminal agent-browser MCP.' >&2
  exit 1
fi

# Browser binaries are cached by agent-browser after first installation.
# Do not print progress to stdout: MCP stdio uses JSON-RPC there.
npx --yes agent-browser@0.43.0 install >&2
exec npx --yes agent-browser@0.43.0 mcp --tools core,debug
