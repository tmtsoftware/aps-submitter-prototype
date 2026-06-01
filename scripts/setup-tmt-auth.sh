#!/bin/bash
# setup-tmt-auth.sh
# Run this after every csw-services restart and before starting the ESW Gateway.
# Sets up the Keycloak TMT realm with the configuration required for ESW Gateway access.

set -e

KEYCLOAK_URL="http://localhost:8081"
REALM="TMT"

echo "==> Getting admin token..."
TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin&grant_type=password&client_id=admin-cli" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get admin token. Is csw-services running?"
  exit 1
fi
echo "    OK"

echo "==> Creating tmt-backend-app client..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
  -d '{"clientId": "tmt-backend-app", "enabled": true, "publicClient": true, "bearerOnly": false}' \
  > /dev/null
echo "    OK"

echo "==> Getting tmt-frontend-app client UUID..."
CLIENT_UUID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=tmt-frontend-app" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

if [ -z "$CLIENT_UUID" ]; then
  echo "ERROR: Could not find tmt-frontend-app client."
  exit 1
fi
echo "    OK (UUID: $CLIENT_UUID)"

echo "==> Adding tmt-backend-app audience mapper to tmt-frontend-app..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$KEYCLOAK_URL/admin/realms/$REALM/clients/$CLIENT_UUID/protocol-mappers/models" \
  -d '{
    "name": "tmt-backend-app-audience",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-audience-mapper",
    "consentRequired": false,
    "config": {
      "included.client.audience": "tmt-backend-app",
      "id.token.claim": "false",
      "access.token.claim": "true"
    }
  }' \
  > /dev/null
echo "    OK"

echo "==> Getting esw-user1 user ID..."
USER_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$KEYCLOAK_URL/admin/realms/$REALM/users?username=esw-user1" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

if [ -z "$USER_ID" ]; then
  echo "ERROR: Could not find esw-user1."
  exit 1
fi
echo "    OK (UUID: $USER_ID)"

echo "==> Getting aps-user role ID..."
ROLE_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$KEYCLOAK_URL/admin/realms/$REALM/roles/aps-user" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

if [ -z "$ROLE_ID" ]; then
  echo "ERROR: Could not find aps-user role."
  exit 1
fi
echo "    OK (UUID: $ROLE_ID)"

echo "==> Assigning aps-user role to esw-user1..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
  -d "[{\"id\": \"$ROLE_ID\", \"name\": \"aps-user\"}]" \
  > /dev/null
echo "    OK"

echo ""
echo "Auth setup complete. You can now start the ESW Gateway."

