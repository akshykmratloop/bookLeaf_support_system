#!/usr/bin/env bash
# Delete everything the demo uses: the AWS box, its IP, database, secret, release bucket, roles
# and budget (terraform destroy), and the two Vercel projects (when VERCEL_TOKEN is set).
# This cannot be undone: the demo database is deleted with the box.
set -euo pipefail

export AWS_PROFILE=${AWS_PROFILE:-loopmethods}
TF_DIR="$(cd "$(dirname "$0")/../terraform" && pwd)"
VERCEL_SCOPE=${VERCEL_SCOPE:-akshay-kumars-projects-af3b1e32}
VERCEL_PROJECTS=(bookleaf-support-ak bookleaf-authors)

terraform -chdir="$TF_DIR" init -input=false
terraform -chdir="$TF_DIR" destroy "$@"

if [ -n "${VERCEL_TOKEN:-}" ]; then
  for project in "${VERCEL_PROJECTS[@]}"; do
    echo "Removing Vercel project $project"
    yes | npx --yes vercel@latest project rm "$project" --token "$VERCEL_TOKEN" --scope "$VERCEL_SCOPE" \
      || echo "  (not removed — delete it in the Vercel dashboard)"
  done
else
  echo "VERCEL_TOKEN not set: delete ${VERCEL_PROJECTS[*]} in the Vercel dashboard."
fi

echo
echo "Finally, in GitHub → Settings → Secrets and variables → Actions, remove"
echo "AWS_DEPLOY_ROLE_ARN, VERCEL_TOKEN and the BookLeaf variables."
