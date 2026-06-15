#!/usr/bin/env bash
set -euo pipefail

echo "=== Security Scan ==="

# pnpm audit for dep vulnerabilities
echo "--- pnpm audit ---"
pnpm audit --audit-level=high || true

# Checkov for IaC security
echo "--- Checkov (IaC) ---"
if command -v checkov &>/dev/null; then
  checkov -d infra/terraform/ --compact --quiet || true
else
  echo "checkov not installed, skipping"
fi

# Gitleaks for secret scanning
echo "--- Gitleaks ---"
if command -v gitleaks &>/dev/null; then
  gitleaks detect --no-git --source . --verbose || true
else
  echo "gitleaks not installed, skipping"
fi

echo "=== Scan complete ==="
