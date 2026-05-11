#!/usr/bin/env bash
set -euo pipefail

CLI="node cli/zerion.js"

echo "=== Creating Agent Token ==="
echo ""
echo "This will prompt for your wallet passphrase."
echo "The token will be saved to config and used automatically for trading."
echo ""

WALLET_NAME="${1:-main}"

# Get policy IDs from list-policies output
POLICY_IDS=$($CLI agent list-policies 2>/dev/null | node -e "
  let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    try {
      const p=JSON.parse(d);
      const ids=(p.policies||[]).map(x=>x.id).join(',');
      process.stdout.write(ids);
    } catch(e) {
      process.stderr.write('Failed to parse policies\\n');
      process.exit(1);
    }
  });
")

if [ -z "$POLICY_IDS" ]; then
  echo "No policies found. Run ./scripts/setup-policies.sh first."
  exit 1
fi

echo "Attaching policies: $POLICY_IDS"
echo ""

$CLI agent create-token --name "${WALLET_NAME}-agent" --wallet "$WALLET_NAME" --policy "$POLICY_IDS"

echo ""
echo "=== Agent Token Created ==="
echo "The bot can now trade using this token."
