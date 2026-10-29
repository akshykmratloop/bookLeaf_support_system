#!/usr/bin/env bash
# Copy ANTHROPIC_API_KEY and OPENAI_API_KEY from your local .env into the demo box's secret.
# Optional: without them the app runs on its rule-based fallback and voice is off.
# Takes effect on the next deploy (or `sudo bookleaf-load-env` + restart on the box).
set -euo pipefail

export AWS_PROFILE=${AWS_PROFILE:-loopmethods}
REGION=${AWS_REGION:-ap-south-1}
SECRET_ID=${SECRET_ID:-bookleaf/demo/env}
ENV_FILE=${1:-"$(cd "$(dirname "$0")/../.." && pwd)/.env"}

read_key() { grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true; }
ANTHROPIC=$(read_key ANTHROPIC_API_KEY)
OPENAI=$(read_key OPENAI_API_KEY)

echo "From $ENV_FILE:"
echo "  ANTHROPIC_API_KEY: $([ -n "$ANTHROPIC" ] && echo "set (${#ANTHROPIC} chars)" || echo empty)"
echo "  OPENAI_API_KEY:    $([ -n "$OPENAI" ] && echo "set (${#OPENAI} chars)" || echo empty)"
read -r -p "Write these into $SECRET_ID? [y/N] " answer
[ "$answer" = "y" ] || { echo "Nothing changed."; exit 0; }

CURRENT=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$SECRET_ID" \
  --query SecretString --output text)
UPDATED=$(echo "$CURRENT" | jq -c --arg a "$ANTHROPIC" --arg o "$OPENAI" \
  '.ANTHROPIC_API_KEY = $a | .OPENAI_API_KEY = $o')
aws secretsmanager put-secret-value --region "$REGION" --secret-id "$SECRET_ID" \
  --secret-string "$UPDATED" >/dev/null
echo "Done. Redeploy the backend (a commit with -deploy-be) to use them."
