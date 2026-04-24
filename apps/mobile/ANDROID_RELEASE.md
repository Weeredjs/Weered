# Weered Android — release runbook

## One-time setup

1. Create an Expo account: https://expo.dev/signup (free).
2. Install EAS CLI globally: `npm i -g eas-cli` (or use `pnpm dlx eas-cli` per command).
3. From `apps/mobile`: `eas login` then `eas init --id <project-id-it-creates-for-you>`.
   This writes the project ID into `app.json` under `extra.eas.projectId`.
4. Create a Google Play Console account: https://play.google.com/console (US$25 one-time).
5. Reserve the package name `ca.weered.app` in Play Console (create the app shell).

## Per-release flow

```bash
cd apps/mobile

# 1. Bump version + versionCode in app.json (required for every Play upload)
#    expo.version = "0.1.1"
#    expo.android.versionCode = 2  (must increment every Play upload)

# 2. Build the AAB on Expo's cloud (no Android Studio needed locally).
#    First run will prompt to generate a keystore — let Expo manage it.
eas build --profile production --platform android

# 3. When the build finishes, submit to the internal track.
eas submit --profile production --platform android --latest
```

The first `eas build` takes ~15-20 min on Expo's free tier. Subsequent builds ~10 min.

## Required Play Store assets (collect once)

Stored under `apps/mobile/assets/store/` (create the dir on first release):
- App icon: 512×512 PNG (square, no rounded corners — Play does it)
- Feature graphic: 1024×500 PNG (banner displayed atop the listing)
- Screenshots: 2-8 phone screenshots (min 320px short side, 16:9 or 9:16)
- Optional: tablet screenshots (10" preferred)
- Short description: ≤ 80 chars
- Full description: ≤ 4000 chars
- App category: Social
- Content rating: complete the Play questionnaire (Weered = Teen at minimum because of voice chat with strangers)
- Privacy policy URL: https://weered.ca/privacy

## Internal testing → production rollout

1. First builds publish to the **Internal Testing** track via `eas submit`. Add testers by email in Play Console.
2. After Internal Testing is stable, promote in Play Console UI: Internal → Closed → Open → Production.
3. First production submission triggers a Google review — usually 1-7 days for a new app.

## Common gotchas

- `versionCode` MUST be a strictly increasing integer for every upload, even if `version` doesn't change.
- The first build will fail if Expo can't find a Sentry DSN (mobile Sentry is optional — add `EXPO_PUBLIC_SENTRY_DSN` to eas.json env if needed, or leave unset).
- Deep links via `weered://` work only after Play approves the app's domain ownership (you upload a `assetlinks.json` to https://weered.ca/.well-known/assetlinks.json — Expo prints the exact contents after the first build).
- If the Apple Sign In gap matters later, the iOS path is structurally similar but requires an Apple Developer account ($99/yr).
