#!/usr/bin/env bash
set -euo pipefail

CLI="node cli/zerion.js"

echo "=== Creating Zerion Policies ==="
echo ""

echo "1. Creating 'solana-lock' policy (chain restricted to Solana)..."
$CLI agent create-policy --name solana-lock --chains solana
echo ""

echo "2. Creating 'safe-trading' policy (deny transfers + deny approvals + 24h expiry)..."
$CLI agent create-policy --name safe-trading --deny-transfers --deny-approvals --expires 24h
echo ""

echo "=== Policies Created ==="
echo ""
echo "Current policies:"
$CLI agent list-policies
echo ""
echo "Next: run ./scripts/setup-token.sh to create an agent token with these policies."
