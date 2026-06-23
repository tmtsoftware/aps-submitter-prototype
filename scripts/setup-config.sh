#!/bin/bash
# setup-config.sh
# Loads APS sequence templates into the CSW Config Service.
# Must be run after every csw-services restart (the Config Service resets on restart).
# Can also be run mid-session to update sequence data without restarting CSW.
#
# Run from the aps-submitter-prototype project root:
#   ./scripts/setup-config.sh

set -e

cs launch csw-config-cli -- login

upload_config() {
  local LOCAL_FILE="$1"
  local CONFIG_PATH="$2"
  local COMMENT="$3"

  if [ ! -f "$LOCAL_FILE" ]; then
    echo "ERROR: $LOCAL_FILE not found."
    exit 1
  fi

  EXISTS=$(cs launch csw-config-cli -- exists "$CONFIG_PATH" 2>/dev/null)

  if echo "$EXISTS" | grep -q "true"; then
    echo "$CONFIG_PATH — exists, updating."
    cs launch csw-config-cli -- update "$CONFIG_PATH" \
      --in "$LOCAL_FILE" \
      --comment "$COMMENT (updated)"
  else
    echo "$CONFIG_PATH — not found, creating."
    cs launch csw-config-cli -- create "$CONFIG_PATH" \
      --in "$LOCAL_FILE" \
      --comment "$COMMENT"
  fi

  cs launch csw-config-cli -- resetActiveVersion "$CONFIG_PATH" \
    --comment "set active to latest"

  echo "Done: $CONFIG_PATH"
  echo ""
}

upload_config \
  "apssubmitterprototype-backend/src/main/resources/sequences/testmode.json" \
  "/aps/sequences/testmode.json" \
  "APS software-only mode test sequence"

upload_config \
  "apssubmitterprototype-backend/src/main/resources/sequences/peas-sequencer-b-testmode.json" \
  "/aps/sequences/peas-sequencer-b-testmode.json" \
  "APS PEAS Sequencer B test sequence"

echo "Config Service setup complete."
