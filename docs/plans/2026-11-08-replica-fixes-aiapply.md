# Replica fixes and AIApply trial plan

Date: 2026-11-08
Authority: this is the sole implementation plan for the Replica fork task; no GSD/OpenSpec plan exists in the fork.
Source baseline inspected: `6e79299d9505f363b2bc08aad700ddcf4e3fe00c` on `fix/windows-and-comparison-gates` (`https://github.com/joelfuller2016/replica`). The later journal-only branch commit is not a code baseline.
Status: in progress; pin the final implementation commit and verification evidence before handoff.

## Goal and boundary

Repair the fork’s Windows path handling, comparison behavior when a selected level has no measurable gated axis, URL raster-only motion scoring, and skill metadata compatibility. Then run the documented self-test and an anonymous, read-only browser trial against `https://aiapply.co/`.

The trial is a tool evaluation, not an AIApply rebuild. Do not sign in, retain auth state, submit forms/applications, touch ATS or payment flows, or commit copied site assets or raw captures. Keep transient evidence under ignored `.replica/` and report live-site variability honestly.

## Evidence and assumptions

- `skills/replica/scripts/test/selftest.mjs` used `URL.pathname` for its CLI and fixture paths. The preflight reproduced the Windows `C:\C:\...` path failure; the narrow `fileURLToPath(new URL(...))` adapter passed its focused path fixtures.
- In `scripts/replica.mjs`, URL motion computes frame ratios/activity but returns `scoreTracks(...)` for `meta.kind === 'url'`, so its raster score is unused. `lib/inpage.js` samples DOM box/style values and treats canvas as media; a canvas redraw that leaves those values fixed is absent from DOM tracks. This is source-inferred until the implementation regression is run on the integrated branch. A core-worker probe is reported, but its exact output still needs independent review.
- Structure gates are layout ≥90 and motion ≥85 (`skills/replica/SKILL.md`). A static image has no layout or motion axis. With no gated axes, the current scoring path yields a null overall and `lib/report.mjs` formats it with `toFixed`; the pass predicate also uses `every` on an empty list, so guard this combination before reporting. No external false PASS was observed; the current reported outcome is a report-formatting error.
- Preflight reported the literal `<url>` in the skill description rejected by the available metadata validator; replacing it with a plain phrase passed that probe. Native Codex skill-loader behavior remains unverified. Do not present metadata validation as native-loader verification.
- The package declares Node `>=20` and `npm test` runs `test/selftest.mjs`. The baseline had no CI workflow. Preflight reported `aiapply.co` returned HTTP 200 and `#lp-header-h1` was present; reconfirm during the live trial.

## Dependency order and ownership

| Order | Work | Owner/files |
|---|---|---|
| 1 | Keep regressions ahead of behavior changes. Reproduce the Windows path failure, image + `structure` no-gate failure, and a URL page whose canvas motion is visible only in raster frames. Capture exact exit/output evidence. | Core: new regression tests/fixtures and engine repro. Compatibility: existing `test/selftest.mjs` path conversion. |
| 2 | Fix OS-path conversion where Node paths are formed, including the Playwright install hint in `lib/capture.mjs`. Give image + `structure` an intentional, actionable no-gated-axes result; never serialize a null score or allow vacuous success. | Core: `scripts/replica.mjs`, `scripts/lib/capture.mjs`, `scripts/lib/report.mjs`, other `scripts/lib/*` as justified. |
| 3 | Add raster-only URL motion evidence without weakening configured motion gates or breaking own-brand/markup-agnostic structure comparisons. Reproduce the gap first; compare candidate motion metrics against static-brand, same-motion and missing/mismatched-motion controls. | Core: motion/pixel engine and new test fixtures. |
| 4 | Update the existing self-test harness to use `fileURLToPath`; fix the rejected metadata phrase; wire core regressions into `npm test`; document Windows setup and CI. | Compatibility: `test/selftest.mjs`, `SKILL.md`, `scripts/package.json`, `README.md`, `.github/workflows/test.yml`. |
| 5 | Integrate and run full local acceptance, then inspect Windows and Linux CI results. Preserve the current 90/85 structure gates, 95/95/85/90 faithful gates and 98/98/97/95 exact gates. | Primary integrator; CI owns hosted evidence. |
| 6 | After the integrated fixes are pinned to a commit, run anonymous AIApply captures at desktop and mobile sizes, repeat the same target to assess volatility, then compare with a deliberately mismatched synthetic local page. Inspect blueprint, reports, sheets, and exit status. | Live-trial worker; no source changes required. |

The parent has already published the fork’s kickoff journal entry. Keep this document as the only task plan and do not create another tracker.

## Design choices and experiments

1. **File paths:** prefer Node’s `fileURLToPath` on `new URL(...)` values instead of manually stripping a leading slash or decoding URL text. Exercise a Windows checkout path and the browser-install diagnostic, including a path containing spaces if available.
2. **No gated axes:** recommended behavior is a clear CLI usage/unsupported-combination error (exit 2, consistent with the documented error code) before report/history files are written. Alternative: an explicit `NOT YET` result with a null/unscored overall and a written explanation. Both must avoid an exception and must never print PASS when no metric was gated. Keep screenshot comparisons that do have an applicable pixel gate working.
3. **Raster motion:** do not use raw absolute frame similarity as the URL motion score. That would make static brand/content differences fail the structure-level own-brand contract. A candidate is to compare temporal raster changes alongside DOM tracks; validate both same motion with a large static brand difference (must still pass structure motion) and missing/wrong raster motion (must fail). Use a bounded phase/direction stress case if the candidate can address it without broad optical-flow/image-registration work or new dependencies. If it cannot, document that limitation rather than claiming universal raster equivalence.
4. **Skill loading:** run the current local metadata validator on final `SKILL.md`. Separately try a read-only native Codex loader check only if an existing supported route is available; otherwise record that as unverified.

## Acceptance checks

- `npm ci`, `npx playwright install chromium`, and `npm test` pass from `skills/replica/scripts` on Windows; the Windows CI job runs the same suite. Ubuntu CI is a portability cross-check.
- Existing self-test behaviors remain intact: exact self-match, equivalent markup/JS motion pass, planted DOM bugs and motion fail, and resize/placeholder behavior remains asserted.
- New regressions prove: Windows file URLs resolve to valid OS paths; no-gated-axis image comparison exits deliberately with an actionable message and creates no report/history; URL canvas/raster motion is scored; same trajectory with a substantial static brand change meets structure motion ≥85; missing raster motion falls below 85 and returns exit 1. If phase/direction cannot be covered by the bounded metric, name that limit in the result. DOM motion positives/negatives continue to pass/fail without lower gates.
- Final skill metadata passes the available validator. State native Codex loading separately as verified or unavailable.
- CI results identify OS and Node versions; distinguish them from local results. Record the final source commit.
- AIApply trial records the selector, viewports, repeat-capture variance and negative-control result. The deliberately mismatched synthetic clone returns `NOT YET` / exit 1 with a reviewable report; captures are reviewed in place and not committed. If the live page or selector is unstable, document the limitation and exact evidence rather than forcing a pass.
