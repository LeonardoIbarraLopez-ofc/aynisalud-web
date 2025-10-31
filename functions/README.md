Functions skeleton for AyniSalud

Files created:
- src/index.ts: callable functions `getPatientEhr` and `addEhrEvent`.
- src/utils.ts: helper utilities (auth checks, audit log).

How to run locally (PowerShell):

# 1. install deps
cd functions
npm install

# 2. start emulator (you need firebase-tools installed and firebase project initialized):
npm run start

# 3. invoke callables from Admin SDK or using the emulator UI

Notes:
- Before deploy, set up Firebase project and service account for CI.
- Test rules in emulator and write unit tests for authorization logic.
