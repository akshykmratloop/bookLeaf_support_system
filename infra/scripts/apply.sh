#!/usr/bin/env bash
# Create or update the BookLeaf demo infrastructure on AWS, then print what GitHub needs.
# Usage: infra/scripts/apply.sh            (plan, ask, apply)
#        infra/scripts/apply.sh -auto-approve
set -euo pipefail

export AWS_PROFILE=${AWS_PROFILE:-loopmethods}
EXPECTED_ACCOUNT=533063875346
TF_DIR="$(cd "$(dirname "$0")/../terraform" && pwd)"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
if [ "$ACCOUNT" != "$EXPECTED_ACCOUNT" ]; then
  echo "AWS profile '$AWS_PROFILE' is account $ACCOUNT, expected $EXPECTED_ACCOUNT. Stopping." >&2
  exit 1
fi

terraform -chdir="$TF_DIR" init -input=false
terraform -chdir="$TF_DIR" apply "$@"

echo
echo "Add these to GitHub → repo Settings → Secrets and variables → Actions"
echo "(plus the secret VERCEL_TOKEN from https://vercel.com/account/tokens):"
terraform -chdir="$TF_DIR" output -json github_config | jq .
