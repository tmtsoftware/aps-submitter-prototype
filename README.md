# aps-submitter-prototype

This project contains a React web application subproject that submits sequences, and a backend service that read them from configuration.  See README files for each of these subprojects for details on build, run, etc.


# APS Submitter Prototype — Startup Guide

> **Important:** Keycloak and the Config Service reset on every `csw-services` restart.
> Steps 2, 3, and 7 must be repeated each time.

> **Important:** This guide assumes all projects are downloaded to the user's Desktop/Prototyping directory, which should be updated to something like $(GIT_HOME) or $(PROTOTYPING_HOME)

---

## 1. Start CSW Services

```bash
csw-services start --location --auth --config --event --database
```

## 2. Run Auth Setup Script

Must be run after every `csw-services` restart and before starting the ESW Gateway.

```bash
cd ~/Desktop/Prototyping/aps-submitter-prototype
./scripts/setup-tmt-auth.sh
```

Expected output:
```
==> Getting admin token...
    OK
==> Creating tmt-backend-app client...
    OK
==> Getting tmt-frontend-app client UUID...
    OK (UUID: ...)
==> Adding tmt-backend-app audience mapper to tmt-frontend-app...
    OK
==> Getting esw-user1 user ID...
    OK (UUID: ...)
==> Getting aps-user role ID...
    OK (UUID: ...)
==> Assigning aps-user role to esw-user1...
    OK

Auth setup complete. You can now start the ESW Gateway.
```

## 3. Start ESW Gateway

```bash
cat > /tmp/command-role-mapping.conf << 'EOF'
APS.primary.startSequence: [aps-user]
EOF

esw-gateway-server start -p 8090 -l -c /tmp/command-role-mapping.conf
```

## 4. Start APS Sequencer

```bash
cd ~/Desktop/Prototyping/aps-sequencer-prototype
sbt "runner/run sequencer -s APS -n primary -m APS_software_only_mode"
```

## 5. Start Submitter Backend

```bash
cd ~/Desktop/Prototyping/aps-submitter-prototype/apssubmitterprototype-backend
source ~/.zshrc
sbt "run start --port 8084"
```

## 6. Start Submitter Frontend

```bash
cd ~/Desktop/Prototyping/aps-submitter-prototype/apssubmitterprototype-frontend
npm start
```

## 7. Load Sequence Data into Config Service

Must be run after every `csw-services` restart (Config Service resets too).

```bash
python3 -c "
import json
source = 'APS.sequenceSubmitter'
matrix = [[0.0] * 3 for _ in range(492)]
actuatorOffsets = {
    'FloatMatrixKey': {
        'keyName': 'actuatorOffsets',
        'values': [matrix],
        'units': 'millimeter'
    }
}
sequence = [
    {'_type': 'Setup', 'source': source, 'commandName': 'calc-colorstep', 'paramSet': []},
    {'_type': 'Setup', 'source': source, 'commandName': 'cmd-m1cs-moves', 'paramSet': [actuatorOffsets]},
    {'_type': 'Setup', 'source': source, 'commandName': 'calc-tt-offsets-to-acts', 'paramSet': []},
    {'_type': 'Setup', 'source': source, 'commandName': 'calc-decompose-acts', 'paramSet': []}
]
print(json.dumps(sequence, indent=2))
" > ~/aps-sequence.json

cs launch csw-config-cli -- login

cs launch csw-config-cli -- create /aps/sequences/testmode.json \
  --in ~/aps-sequence.json \
  --comment "APS software-only mode test sequence"
```

## 8. Start the Computation Assembly

```bash
cd ~/Desktop/Prototyping/aps-computation-assembly-prototype
sbt "aps-computationprototypedeploy/runMain aps.computationprototypedeploy.ComputationprototypeContainerCmdApp --local ./src/main/resources/JComputationprototypeassemblyStandalone.conf"
```

## 9. Start the Procedure Data Service

```bash
cd ~/Desktop/Prototyping/aps-procedure-data-service
DB_READ_USERNAME=admin DB_READ_PASSWORD=Zernike1 DB_WRITE_USERNAME=admin DB_WRITE_PASSWORD=Zernike1 sbt "run start -p 8084"
```

## 10. Use the App

1. Open `http://localhost:3000`
2. Log in with `esw-user1` / `esw-user1`
3. Enter config path: `/aps/sequences/testmode.json`
4. Click **Load Template**
5. Click **Submit Sequence**

Expected response:
```json
{
  "_type": "Completed",
  "runId": "...",
  "result": { "paramSet": [] }
}
```

---

## Notes

- The Keycloak admin UI at `http://localhost:8081` only shows the `master` realm.
  The TMT realm must be managed via the API — the `setup-tmt-auth.sh` script handles this.
- Predefined TMT realm users (password = username):
  `esw-user1`, `config-admin1`, `config-user1`, `iris-user1`, `tcs-user1`, `wfos-user1`
- The Config Service resets on `csw-services` restart — sequence files must be re-uploaded each time.
- Why `tmt-backend-app` must be created manually: the ESW Gateway's `application.conf` references
  this client for token validation, but the embedded Keycloak from `csw-services` does not include
  it by default. This appears to be a gap in the development tooling.






# How to Use the Project

The project has following structure:

```bash
.
├── src
│   ├── assets
│   ├── components
│   ├── config
│   ├── contexts
│   ├── hooks
│   ├── models
│   ├── routes
│   ├── utils
├── test
├── types
```

* `assets`: This directory contains all the files (images, audio etc) that are used by the UI component.
* `components`: This directory contain all the components created for this UI application.
* `config`: This contain the application specific configurations.
* `contexts`: This contain contexts like LocationServiceContext to pass and share data to nested react conponents.
* `hooks`: This contain helper hooks.
  * `useAuth.tsx` This file contain auth related helper hooks and exposes login, logout and auth constants.
  * `useQuery.tsx` This file contain hooks to query data asynchronous and expose other constants like loading, error to track query state.
* `routes`: This contain route related files.
  * `Routes.tsx` This file uses react-router to describe frontend routes for this application.
  * `ProtectedRoute.tsx` This file contain auth protected frontend routes.
* `utils`: This contain common utilities.
  * `Http.ts` has generic helper functions written over fetch API to do GET, POST requests.
  * `api.ts` This file uses `Http.ts` and provide application specific functions to do POST requests.
  * `resolveBackend.ts` This file contain helper function to resolve location of backend using location service.
* `test`: This directory contains all the tests for the UI application.
* `types`: This directory contains all the types that needs to be imported externally for UI application.

## References

* ESW-TS Library - [Link](https://tmtsoftware/esw-ts/)
* ESW-TS Library Documentation - [Link](https://tmtsoftware.github.io/esw-ts/)
