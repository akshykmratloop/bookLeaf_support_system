#!/usr/bin/env bash
# Start the demo box if it is stopped, then wait until SSM can run commands on it.
# Env: INSTANCE_ID (AWS credentials and region come from the job).
set -euo pipefail

state=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].State.Name' --output text)
echo "instance is $state"
if [ "$state" != running ]; then
  aws ec2 start-instances --instance-ids "$INSTANCE_ID" >/dev/null
  aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
  echo "started"
fi

# Ask once with stderr kept, so a missing permission fails now and says so.
if ! err=$(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
  --query 'InstanceInformationList[0].PingStatus' --output text 2>&1); then
  echo "::error::cannot read SSM status: $err"
  exit 1
fi

for i in $(seq 1 60); do
  ping=$(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
    --query 'InstanceInformationList[0].PingStatus' --output text)
  if [ "$ping" = Online ]; then
    echo "SSM online"
    exit 0
  fi
  [ "$i" = 60 ] && { echo "::error::SSM still reports '$ping' after 10 minutes"; exit 1; }
  sleep 10
done
