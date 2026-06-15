#!/bin/bash
# setup-config.sh
# Loads APS sequence templates into the CSW Config Service.
# Must be run after every csw-services restart (the Config Service resets on restart).
# Can also be run mid-session to update sequence data without restarting CSW.
#
# Run from the aps-submitter-prototype project root:
#   ./scripts/setup-config.sh

set -e

LOCAL_FILE="apssubmitterprototype-backend/src/main/resources/sequences/testmode.json"
CONFIG_PATH="/aps/sequences/testmode.json"

if [ ! -f "$LOCAL_FILE" ]; then
  echo "ERROR: $LOCAL_FILE not found."
  exit 1
fi

cs launch csw-config-cli -- login

EXISTS=$(cs launch csw-config-cli -- exists "$CONFIG_PATH" 2>/dev/null)

if echo "$EXISTS" | grep -q "true"; then
  echo "File exists — updating."
  cs launch csw-config-cli -- update "$CONFIG_PATH" \
    --in "$LOCAL_FILE" \
    --comment "APS software-only mode test sequence (updated)"
else
  echo "File not found — creating."
  cs launch csw-config-cli -- create "$CONFIG_PATH" \
    --in "$LOCAL_FILE" \
    --comment "APS software-only mode test sequence"
fi

cs launch csw-config-cli -- resetActiveVersion "$CONFIG_PATH" \
  --comment "set active to latest"

echo ""
echo "Config Service setup complete: $CONFIG_PATH"
