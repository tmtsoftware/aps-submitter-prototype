# ESW Gateway Keycloak Setup

This documents the one-time Keycloak configuration required to use the ESW Gateway
with a frontend app in a CSW/ESW development environment.

## Context

- CSW services started with: `csw-services start --location --auth --config --event --database`
- Keycloak admin console: `http://localhost:8081` (login: `admin`/`admin`)
- Keycloak API base: `http://localhost:8081/admin/realms/TMT`
- ESW Gateway started with: `esw-gateway-server start -p 8090 -l -c /tmp/command-role-mapping.conf`
- The gateway's `auth-config` (in its `application.conf`) references `client-id = tmt-backend-app` and `realm = TMT`

## Problem

The embedded Keycloak that `csw-services` starts does not include a `tmt-backend-app`
client by default, and tokens issued to the frontend do not include `tmt-backend-app`
in their audience. The gateway rejects all tokens silently with 403 Forbidden and
`x-tmt-username: unknown` in request headers.

## Required Setup Steps

### Step 1 — Get an admin token

Run this first. The token expires in 60 seconds so run subsequent steps quickly,
or re-run this line before each step.

```bash
TOKEN=$(curl -s -X POST "http://localhost:8081/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin&grant_type=password&client_id=admin-cli" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

### Step 2 — Create the `tmt-backend-app` client

The gateway validates tokens against this client. It must exist in the TMT realm.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:8081/admin/realms/TMT/clients" \
  -d '{"clientId": "tmt-backend-app", "enabled": true, "publicClient": true, "bearerOnly": false}'
```

### Step 3 — Find the `tmt-frontend-app` client ID

The frontend app uses `tmt-frontend-app`. You need its internal Keycloak UUID to
add a mapper to it.

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/admin/realms/TMT/clients?clientId=tmt-frontend-app" \
  | python3 -m json.tool | grep '"id"' | head -1
```

Note the UUID value (e.g. `963dec63-a99f-4030-ad4e-57efe8c00207`).

### Step 4 — Add `tmt-backend-app` audience mapper to `tmt-frontend-app`

This adds `tmt-backend-app` to the `aud` claim of tokens issued by `tmt-frontend-app`,
which the gateway requires for token validation.

Replace `<CLIENT-UUID>` with the UUID from Step 3.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:8081/admin/realms/TMT/clients/<CLIENT-UUID>/protocol-mappers/models" \
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
  }'
```

### Step 5 — Assign `aps-user` role to your user

The gateway checks for `{subsystem}-user` role for sequencer commands. For APS
sequencer submissions the user needs `aps-user`.

First, find the user ID:
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/admin/realms/TMT/users" \
  | python3 -m json.tool | grep -E '"id"|"username"'
```

Then get the `aps-user` role ID:
```bash
ROLE_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/admin/realms/TMT/roles/aps-user" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
```

Then assign the role (replace `<USER-UUID>` with the user's ID):
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:8081/admin/realms/TMT/users/<USER-UUID>/role-mappings/realm" \
  -d "[{\"id\": \"$ROLE_ID\", \"name\": \"aps-user\"}]"
```

### Step 6 — Create the command role mapping file

The gateway requires a command role mapping file. For APS sequencer access:

```bash
cat > /tmp/command-role-mapping.conf << 'CONF'
APS.primary.startSequence: [aps-user]
CONF
```

### Step 7 — Start the gateway

```bash
esw-gateway-server start -p 8090 -l -c /tmp/command-role-mapping.conf
```

### Step 8 — Log in as a user with `aps-user` role

In the frontend app, log in as the user you assigned `aps-user` to in Step 5.
The predefined user `esw-user1` (password: `esw-user1`) is a good choice after
assigning `aps-user` to it.

## Notes

- Steps 2–5 only need to be done once per Keycloak instance. They persist across
  gateway and service restarts as long as `csw-services` is not restarted.
- If `csw-services` is restarted, Keycloak resets and all steps must be repeated.
- The `tmt-frontend-app` client UUID and user UUIDs are specific to each Keycloak
  instance — always look them up rather than hardcoding them.
- The Keycloak admin UI at `http://localhost:8081` only shows the `master` realm.
  The TMT realm is created programmatically and must be managed via the API.
- The predefined users in the TMT realm (all with password = username) are:
  `config-admin1`, `config-user1`, `dummy-user`, `esw-user1`, `iris-user1`,
  `osw-user1`, `tcs-user1`, `wfos-user1`
