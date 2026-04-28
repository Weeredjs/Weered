# Weered Android — release runbook

## Status: build-ready, account-gated

`expo-doctor` schema/icon/peer-dep blockers cleared 2026-04-27. Remaining steps require an Expo account + Play Console account, which only James can create.

---

## Step 1 — Expo account & EAS CLI (10 min, one-time)

`npm` isn't on this machine's PATH; run these from a Node-aware terminal (Node was installed via `nvm4w`, so open the "nvm" cmd prompt or any terminal where `npm` resolves).

```bash
# Sign up if you haven't: https://expo.dev/signup (free)
npm i -g eas-cli           # global install of EAS CLI

cd C:/Weered/apps/mobile
eas login                  # opens browser to authenticate
eas init                   # creates EAS project, writes projectId into app.json
```

`eas init` will prompt to confirm the package — accept `ca.weered.app`. It rewrites `app.json` to add `extra.eas.projectId`. **Commit that change** so future builds aren't tied to one machine.

## Step 2 — First preview build (15-20 min, no Play Console needed)

This produces an APK you can sideload onto any Android phone for friends/internal testers. Doesn't touch Play Store.

```bash
cd C:/Weered/apps/mobile
eas build --profile preview --platform android
```

EAS will:
- Generate an Android keystore (let it manage — answer "yes")
- Build on Expo's cloud (free tier, ~15-20 min)
- Print a download URL for the .apk when done

Send that URL to anyone with an Android phone, they install, done.

## Step 3 — Play Console setup (45 min, one-time, $25)

This unblocks the Play Store internal track.

1. Sign up at https://play.google.com/console ($25 one-time payout to Google)
2. Create app → name "Weered" → package name `ca.weered.app` (must match `app.json`)
3. Main store listing — paste copy from `assets/store/listing.md`:
   - App name, short/full description, category, tags
   - Privacy policy URL: `https://weered.ca/privacy`
   - Support email: `support@weered.ca`
4. Upload visual assets:
   - **App icon** — Play Console pulls this from the .aab automatically
   - **Feature graphic** — `assets/store/feature-graphic.png` (1024×500, already generated)
   - **Phone screenshots** — take 4-6 from your phone (see `listing.md` for the suggested shots)
5. Content rating questionnaire — answer truthfully. Voice chat with strangers + UGC = Teen.
6. Target audience — 13+
7. Data safety — disclose what we collect (auth credentials, in-app text/voice messages, presence). Don't oversell privacy claims; truthful is fine.

## Step 4 — Production build + submit

```bash
# Bump version + versionCode in app.json (REQUIRED for every Play upload)
#   expo.version = "0.1.1"  (or whatever)
#   expo.android.versionCode = 2  (must increment every Play upload)

cd C:/Weered/apps/mobile
eas build --profile production --platform android       # ~15-20 min, builds .aab
eas submit --profile production --platform android --latest
```

`eas submit` prompts for a Google service account JSON the first time. Easiest path: in Play Console go to Setup → API access → create a service account with "Release manager" role, download the JSON, point eas-cli at it. Saves the credentials so future submits are one command.

The first submit goes to **Internal Testing**. Add testers by email in Play Console; they install via a special opt-in URL. No public listing yet.

## Step 5 — Internal → Closed → Open → Production

Once Internal Testing is stable:
- Promote in Play Console UI: Internal → Closed (small testers) → Open (anyone with the link) → Production
- First production submission triggers Google review — usually 1-7 days for a new app
- Subsequent updates auto-publish unless you flag for review

---

## What's already done

- ✅ `app.json` schema clean (removed deprecated `newArchEnabled`)
- ✅ Icons square 512×512 (copied from `web/public/brand/logo/weered-logo-512.png`)
- ✅ `react-native-worklets` peer dep installed (required by reanimated 4)
- ✅ `eas.json` profiles wired (development, preview, production)
- ✅ Package name `ca.weered.app` set
- ✅ Deep link intent filters set (`https://weered.ca` + `weered://`)
- ✅ Permissions declared (network, audio, camera)
- ✅ Store listing copy drafted at `assets/store/listing.md`
- ✅ Feature graphic generated at `assets/store/feature-graphic.png`
- ✅ Privacy policy live at `https://weered.ca/privacy`

## What's pending

- ⏳ Phone screenshots — take 4-6 from your phone, drop in `assets/store/screenshots/`
- ⏳ EAS account + `eas init`
- ⏳ Play Console signup ($25)
- ⏳ Sentry DSN for mobile (optional — set `EXPO_PUBLIC_SENTRY_DSN` in eas.json env if you want crash reporting)
- ⏳ Deep link verification — after first build, Expo prints contents of `assetlinks.json` to upload at `https://weered.ca/.well-known/assetlinks.json` so `weered://` links open the app instead of the browser

## Common gotchas

- `versionCode` MUST be a strictly increasing integer for every Play upload (even if `version` doesn't change).
- The pnpm install for `react-native-worklets` took 14 min on this machine due to monorepo size. Future installs will be faster (cache warm).
- Patch-version drift on 10 packages (`expo-doctor` flags) — not blocking. Run `pnpm align` (`expo install --check` under the hood) when convenient.
- iOS path is structurally identical, but requires Apple Developer account ($99/yr). Skip until Android is in production.
