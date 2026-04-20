# Weered Mobile

Expo SDK (latest) + React Native + expo-router + NativeWind + TanStack Query + Zustand + MMKV.

## Setup (first time)

From the monorepo root:

```bash
pnpm install
```

Then from this folder, align Expo peer deps:

```bash
cd apps/mobile
pnpm align
```

## Run on your phone (fastest)

Install **Expo Go** from the Play Store on your Android device.

```bash
pnpm start:go
```

Scan the QR code with Expo Go. Live reload works out of the box.

## Run with a dev client (for native modules not in Expo Go)

```bash
pnpm start
```

## Build a real APK / AAB via EAS (cloud build — no Android Studio needed)

```bash
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest build:configure
pnpm dlx eas-cli@latest build --platform android --profile preview
```

## Config

App identity lives in `app.json`:

- `name`: Weered
- `android.package` / `ios.bundleIdentifier`: `ca.weered.app`
- `scheme`: `weered` (for deep links like `weered://room/xxx`)

API endpoints live in `app.json > expo.extra` and are read via `src/lib/config.ts`.
