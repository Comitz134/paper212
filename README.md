# Paper212 Mobile

Paper212 is a standalone Expo/React Native paper-trading terminal. The scanner,
risk sizing, paper ledger, alert feed and scheduler all run on the phone. It
does **not** need the PC, a server URL, Wi-Fi pairing, an access token or a
broker connection.

## Run

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on the phone, or build a development/release app
with `npx expo run:android` / `npx expo run:ios` on a machine with the
respective native toolchain. Background checks need a development build or
release build; Expo Go is enough for the foreground terminal.

The first launch creates a fresh **$100,000 paper account** and saves it in
async storage. Existing installs that were paired to the PC are migrated
automatically: the old server URL and token are discarded and a local ledger is
created. There is no PC pairing screen any more.

## Android release APK

A signed universal release APK is available at
`releases/Paper212-1.0.0-release.apk` (77,491,860 bytes, about 74 MB).

- **Package:** `com.paper212.mobile`, version 1.0.0, min SDK 24, target SDK 36
- **Signing:** APK Signature Scheme v2, certificate `CN=Paper212`
- **SHA-256:** `01ac186f648181eec3422701a115b2948fea5dfe67842960e7f6247d742a18a0`
- **Native ABIs:** `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`
- **Install (from the repository root):**
  `adb install -r mobile/releases/Paper212-1.0.0-release.apk`, or transfer it to
  the phone and open it with install-from-unknown-apps enabled.

The APK was produced by Gradle from the `expo prebuild` generated `android/`
project. Its embedded Hermes bundle includes `paper212.local.engine.v1`, the
opening-range scanner, the paper ledger and the background refresh task. It
contains no old PC server URL, pairing token or broker integration. The only
`localhost` string is React Native's development-server warning; the release
app never uses it as a backend.

The 74 MB APK is intentionally **not tracked**: `releases/*.apk` is ignored so
the repository does not carry the binary. The APK remains at the path above on
the build machine.

The generated `android/` project is tracked so the native manifest, permissions
and release build configuration are reviewable. Generated build outputs and
`android/local.properties` are ignored. On this Windows host the native build
is run from a short path (`C:\p212`) with CMake staging redirected (`C:\p212c`)
because React Native generates C++ object paths longer than `MAX_PATH`; that
staging setting is in `android/app/build.gradle`.

## Strategy

- **Universe**: AAPL, TSLA, NVDA, MSFT, AMZN and SPY by default.
- **Data**: Yahoo Finance chart API, fetched directly by the phone. `query2` is
  tried first and `query1` is the fallback. No data is routed through the PC.
- **Entries**: 15-minute opening-range breakout, only after a completed close
  above the opening range. Entries are allowed from 09:45 to 15:30 ET.
- **Risk**: $1,000 risk per trade, $10,000 maximum order, 10% maximum position,
  three open positions and three trades per day. A $3,000 daily loss limit
  pauses new entries.
- **Exits**: midpoint stop, 2R target and a 15:55 ET flat-by rule.
- **Storage**: the complete ledger, scanner results, settings and alerts are
  persisted under `paper212.local.engine.v1`. Market holidays, early closes and
  the ET clock are computed on the phone.
- **Alerts**: derived from the local ledger and scanner events. They survive a
  reload because the feed is part of the stored engine state; notification
  preferences filter categories before a local notification is scheduled.

Every order is simulated. The app has no broker integration and cannot place a
real trade.

## Background limits

Foreground checks run while the app is open. Background checks use
`expo-background-task` with a 15-minute OS minimum and are **best effort**:
iOS and Android decide when to wake the app. A force-stopped app cannot be
woken at all. Guaranteed execution after the app is terminated requires a
hosted backend, which this standalone version deliberately does not use.

## Web preview

`npx expo start --web` can render the terminal in a browser for layout checks,
but Yahoo does not return CORS headers, so browser previews cannot fetch live
charts. This does not affect Android/iOS, where the app makes direct HTTPS
requests. Use a native build for real scanning and paper fills.

## Screens

- **Home** — automation equity, today/total P&L, market phase and ET countdown,
  positions with stop/target progress, recent exits, run scan and pause/resume.
- **Scanner** — latest opening-range results, risk verdicts, planned sizes and
  why each symbol is waiting.
- **Activity** — durable local alerts above the audit trail: fills, exits,
  skips, errors and explicit test-event badges.
- **Settings** — local account reset, notification categories, background
  checks, OS permission state and a test notification.

## Checks

```bash
npm test
npx tsc --noEmit
npx expo export --platform android --output-dir dist
```

The Android JS bundle can be built without the Android SDK. The release APK
above was built with the local Android SDK 37.0, build-tools 37.0.0, NDK
27.1.12297006 and Java 17.

## Verification status

Verified on the final tree:

- Root server suite: **55/55**
- Mobile local-engine suite: **6/6**
- Mobile TypeScript: **pass**
- `npx expo-doctor`: **20/20**
- Android release build and embedded JS bundle: **pass**
- APK: v2 signature `CN=Paper212`, 77,491,860 bytes, SHA-256 above
- Installed and launched on an Android 15/API 35 emulator (1080x2340,
  Google Play x86_64 image)
- First-run and reset ledger: **$100,000**, automation **ON**, zero positions,
  and all four tabs usable
- Live Yahoo scan: six symbols and five risk-checked signals; the audit rows
  recorded explicit skip reasons such as current price below the trigger and
  order above the $10,000 cap
- Automatic cadence: scans advanced from **10:44 to 10:47 AM ET** without a
  manual run, and the final build refreshed automatically at **10:56 AM ET**
  after a force-stop/relaunch
- **Pause**, **Resume**, **Run scan**, the **Signals** and **Errors** activity
  filters, the notification permission prompt and Allow action, a test alert on
  the dedicated `paper212-alerts` channel, the background-check toggle, reset,
  and force-stop/relaunch persistence
- Background checks: **OFF** removed the WorkManager job; **ON** re-registered
  it with the 15-minute minimum

Known device/runtime limits:

- No live paper fill was observed during verification: the five live signals
  were either still outside the entry guard or above the order cap, and the
  later clock window had no fresh intraday bars. Paper fills, stop/target exits,
  P&L and alert de-duplication are covered by the deterministic mobile tests.
- Background execution remains OS-controlled. WorkManager registration and
  local test notification delivery were verified, but a 15-minute background
  wake was not forced.
- iOS builds require macOS/Xcode.
