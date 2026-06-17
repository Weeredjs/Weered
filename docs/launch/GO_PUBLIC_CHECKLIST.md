# Go-public checklist

The repo flip and everything external is a manual, deliberate sequence. This is
the order that makes the badges render and the narrative land. None of it is
automated.

## Pre-flip (while still private)

- [ ] **Create the SonarCloud project.** SonarCloud is free for public repos. Log
      in with the GitHub org, import `Weeredjs/Weered`. Confirm the project key is
      `Weeredjs_Weered` and the org key is `weeredjs` (these are what the README
      badges and `sonar-project.properties` already point at). Adjust both if
      SonarCloud assigns different keys.
- [ ] **Add the `SONAR_TOKEN` secret** to the GitHub repo (Settings → Secrets →
      Actions). The `sonar` job in `.github/workflows/ci.yml` is already wired and
      only runs when this secret exists.
- [ ] **Run CI once** (push or manual dispatch) so SonarCloud gets its first
      analysis. The README badges go live only after this first run. Verify each
      badge renders (Quality Gate, Reliability, Security, Maintainability, CI).
- [ ] **Screenshot the clean SonarCloud dashboard** for the announcement.
- [ ] **Final manual pass on the critical paths:** auth/login, lobby join, the
      paper economy mutations, and Stripe tier gating. These are the places a real
      bug actually hurts.
- [ ] **Confirm no secrets in history.** `.env` files are gitignored; double-check
      nothing real was ever committed (tokens, DB URLs, signing keys). This is the
      one thing that is not reversible after going public.
- [ ] **Draft the announcement posts** from ANNOUNCEMENT.md (blog, X, Reddit, HN,
      pinned discussion). Record the 2 to 3 minute demo video (live lobbies,
      a module, FakeOut paper trading).

## The flip

- [ ] Make the repo public.
- [ ] Enable Discussions and Issues. Pin the "Why Weered is public" discussion
      from ANNOUNCEMENT.md so it sets expectations on response time and scope.
- [ ] Confirm the README badges all render on the public repo.

## Post-flip (the rollout)

- [ ] Publish the blog post on weered.ca.
- [ ] Post the X thread linking the blog.
- [ ] Post to the subreddits using the per-community angle (lead with the module,
      not the repo). Check each subreddit's self-promo rules first; tools and
      tournament posts are the safe lane where general self-promo is not.
- [ ] Show HN, if the timing is right (weekday morning US time tends to land).
- [ ] Drop it to the existing community.
- [ ] Watch referrers and issue traffic for the first 48 hours to see what landed.

## Notes

- Keep it anonymous. No real names on any public Weered surface (repo, posts,
  listings). This protects the other identities.
- The license is the moat, not secrecy. Once public, the protection is the
  Elastic License 2.0 managed-service ban plus the fact that the real logic is
  server-side. See LICENSING.md.
- Do not over-respond to licensing-purist noise. "Source-available is not real
  open source" is a known and accepted tradeoff, covered in LICENSING.md.
