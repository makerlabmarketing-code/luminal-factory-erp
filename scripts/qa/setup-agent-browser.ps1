# Run locally in PowerShell from the ERP repository root. Do not run in GitHub Actions.
$ErrorActionPreference = 'Stop'

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'Node.js/npm are required before installing agent-browser.'
}
npm install --global agent-browser@0.43.0
if ($LASTEXITCODE -ne 0) { throw 'agent-browser npm install failed.' }
agent-browser install
if ($LASTEXITCODE -ne 0) { throw 'Chromium installation failed.' }

if (Get-Command codex -ErrorAction SilentlyContinue) {
  $existing = & codex mcp get luminal-agent-browser --json 2>$null
  if ($LASTEXITCODE -ne 0) {
    codex mcp add luminal-agent-browser -- agent-browser mcp
    if ($LASTEXITCODE -ne 0) { throw 'Unable to register browser MCP with Codex.' }
  } else {
    Write-Output 'Codex MCP luminal-agent-browser already configured.'
  }
  Write-Output 'Use codex login to sign in with ChatGPT, if needed.'
} else {
  Write-Warning 'Codex CLI was not found. Install/sign in to Codex, then run: codex mcp add luminal-agent-browser -- agent-browser mcp'
}
Write-Output 'Installed agent-browser 0.43.0. Read docs/qa/erp-browser-qa.md before interacting with ERP.'
