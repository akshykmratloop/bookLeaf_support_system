#!/usr/bin/env bash
# Run one command on the demo box through SSM and follow it until it ends.
# Usage: run-on-box.sh "<command>"     Env: INSTANCE_ID
# Fails (and prints the end of the output) when the command fails, times out or is cancelled.
set -euo pipefail

COMMAND=${1:?usage: run-on-box.sh "<command>"}
RUN_LIMIT_SECONDS=2700
POLL_SECONDS=15

# executionTimeout is the run limit; --timeout-seconds only bounds the wait for the agent.
PARAMS=$(jq -cn --arg c "$COMMAND" --arg t "$RUN_LIMIT_SECONDS" \
  '{commands: [$c], executionTimeout: [$t]}')
cid=$(aws ssm send-command --instance-ids "$INSTANCE_ID" --document-name AWS-RunShellScript \
  --parameters "$PARAMS" --timeout-seconds 600 --query Command.CommandId --output text)
echo "command $cid"

output() {
  aws ssm get-command-invocation --command-id "$cid" --instance-id "$INSTANCE_ID" \
    --query "$1" --output text | tail -n "$2"
}

for _ in $(seq 1 $((RUN_LIMIT_SECONDS / POLL_SECONDS))); do
  status=$(aws ssm get-command-invocation --command-id "$cid" --instance-id "$INSTANCE_ID" \
    --query Status --output text 2>/dev/null || echo Pending)
  case "$status" in
    Success)
      output StandardOutputContent 40
      exit 0
      ;;
    Failed | Cancelled | TimedOut)
      echo "::error::command $status"
      output StandardErrorContent 60
      output StandardOutputContent 80
      echo "full log on the box: /var/log/bookleaf/deploy.log"
      exit 1
      ;;
  esac
  sleep "$POLL_SECONDS"
done

echo "::error::still running after ${RUN_LIMIT_SECONDS}s; check /var/log/bookleaf/deploy.log on the box"
exit 1
