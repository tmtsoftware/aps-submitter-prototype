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

SEQ_DIR="apssubmitterprototype-backend/src/main/resources/sequences"

# ---------------------------------------------------------------------------
# Legacy test sequences
# ---------------------------------------------------------------------------

upload_config \
  "$SEQ_DIR/testmode.json" \
  "/aps/sequences/testmode.json" \
  "APS software-only mode test sequence"

upload_config \
  "$SEQ_DIR/peas-sequencer-b-testmode.json" \
  "/aps/sequences/peas-sequencer-b-testmode.json" \
  "APS PEAS Sequencer B test sequence"

# ---------------------------------------------------------------------------
# RBSF procedure sequences
# ---------------------------------------------------------------------------

upload_config \
  "$SEQ_DIR/rbsf-a1.json" \
  "/aps/sequences/rbsf-a1.json" \
  "RBSF master sequence (Sequencer A)"

upload_config \
  "$SEQ_DIR/rbsf-b1.json" \
  "/aps/sequences/rbsf-b1.json" \
  "RBSF Sequencer B sub-sequence 1 — takeGoodExposureAndFindCentroids, calcImageAndPrOffsets, correctPitTracking"

upload_config \
  "$SEQ_DIR/rbsf-b2.json" \
  "/aps/sequences/rbsf-b2.json" \
  "RBSF Sequencer B sub-sequence 2 — rbsfAskOpIfCmdM2"

upload_config \
  "$SEQ_DIR/rbsf-b3.json" \
  "/aps/sequences/rbsf-b3.json" \
  "RBSF Sequencer B sub-sequence 3 — rbsfCmdM2PttOrPxyIfRespOk, rbsfTakeSnapIfRespOk"

upload_config \
  "$SEQ_DIR/rbsf-c1.json" \
  "/aps/sequences/rbsf-c1.json" \
  "RBSF Sequencer C sub-sequence 1 — centroid offset and M2/segment calculations"

upload_config \
  "$SEQ_DIR/rbsf-c2.json" \
  "/aps/sequences/rbsf-c2.json" \
  "RBSF Sequencer C sub-sequence 2 — rbsfCmdM1IfRespOk through rbsfCmdWhIfRespOk"

upload_config \
  "$SEQ_DIR/rbsf-c3.json" \
  "/aps/sequences/rbsf-c3.json" \
  "RBSF Sequencer C sub-sequence 3 — rbsfWaitM1CmdComplete, rbsfTakeSnapIfM1OrWhCmdSent"

# ---------------------------------------------------------------------------
# Common sequences
# ---------------------------------------------------------------------------

upload_config \
  "$SEQ_DIR/common-d1-rbsf.json" \
  "/aps/sequences/common-d1-rbsf.json" \
  "Common Sequencer D sequence — takeGoodExposure"

echo "Config Service setup complete."
