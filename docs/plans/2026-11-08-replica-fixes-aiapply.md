# Replica fixes and AIApply trial plan

Date: 2026-11-08
Authority: sole plan for this fork task; no OpenSpec or GSD plan exists in the repository.
Repository: `joelfuller2016/replica`, fork of `albertirgi/replica`.
Code pin: `7eb4c1a092f4797dac3a34dfcaea947c98e37f95` (`fix/windows-and-comparison-gates`, pushed to the fork’s `main`).
Status: complete. Local checks, all four hosted jobs, live positive/negative controls, and the app-owned QA/trial notes are verified and linked below.

## Goal and boundary

Repair Windows file URL handling, comparison preflight when no selected-level gate is measurable, URL motion that exists only in raster output, and skill metadata validation. Prove the fixes with existing and added self-tests, Windows/Linux CI and an anonymous read-only trial of `https://aiapply.co/`.

The site trial tests Replica; it is not an AIApply rebuild. No login, auth state, form/application submission, ATS or payment flow was used. Raw captures and sheets remain under ignored `.replica/` and are not committed.

## Baseline findings and chronology

The source was first inspected at `6e79299d9505f363b2bc08aad700ddcf4e3fe00c`.

- `test/selftest.mjs` used `URL.pathname` for Windows CLI/fixture paths; the focused `fileURLToPath(new URL(...))` adapter fixed the reported doubled-drive-path probe. `lib/capture.mjs` had the same URL-to-path issue in the Playwright install hint.
- A static image compared at `structure` had no applicable gated axes: `mean([])` produced `null` and report formatting threw at `toFixed`. This was a formatting error, not an externally observed false PASS. The final CLI rejects the unsupported combination before browser launch/output creation.
- The baseline URL motion scorer computed frame differences but returned only DOM `scoreTracks`; canvas redraws with unchanged element geometry/style were invisible to the motion gate.
- The skill description’s literal `<url>` failed the available validator. A plain-language phrase passes it. The local metadata validator passes on final source; a separate read-only native Codex loader check succeeded in isolation, with no global install.
- Configured gates remain unchanged: structure layout ≥90/motion ≥85; faithful layout/style/pixels/motion ≥95/95/85/90; exact ≥98/98/97/95.

## Accepted implementation contract

- **No applicable gate:** reject before launch/output with exit 2 and an actionable diagnostic. Default round, custom output and history remain absent. Image comparisons at a level with an applicable pixel gate still run and fail normally when below threshold.
- **Raster motion scope:** use the fallback for URL references only when both reference and clone expose zero DOM motion tracks. Existing DOM motion scoring remains in use when either side has tracks. Video-reference scoring is unchanged. Mixed DOM-plus-canvas motion is outside this fix.
- **Raster motion metric:** compare complete adjacent-frame pairs at a common proportional sample with the longest side capped near 1000 pixels. Mark per-pixel activity using a separate temporal YIQ threshold set to 1% of the static pixel threshold. Match changed-pixel footprints symmetrically within one analysis-sample pixel and compare the sign of luminance change. Aggregate the footprint and directed matches by active-pixel count. Static color/branding differences remain on pixel/style axes; raw absolute frame similarity is not the motion gate.
- This is a bounded activity metric, not optical flow or semantic equivalence. It can miss changes below the temporal threshold; strong contrast or palette inversion can affect signed luminance. The README documents these limits.
- **Windows paths/metadata:** use Node `fileURLToPath` in the self-test and install hint. Validate final `SKILL.md` and keep native-loader discovery separate from body invocation/current-chat catalog refresh.

## Ownership and dependency order

| Step | Owner and responsibility | Status |
|---|---|---|
| Core comparison | `scripts/replica.mjs`, `scripts/lib/capture.mjs`, `scripts/lib/pixels.mjs`, regression suite/fixtures. Add no-gate preflight and bounded URL raster fallback. | Complete at code pin. |
| Compatibility and delivery | `test/selftest.mjs`, `SKILL.md`, `scripts/package.json`, `README.md`, `.github/workflows/test.yml`; wire tests and document Windows, CI and raster limits. | Complete at code pin. |
| Local/hosted verification | Run the full locked suite locally; verify preflight red/restore/green; inspect Windows/Linux CI receipts. | Complete; evidence below. |
| Browser trial | Capture `#lp-header-h1` at desktop/mobile sizes, repeat the same live target, and compare a synthetic mismatched local page. | Complete; evidence below. |

## Acceptance evidence

| Check | Result and retained evidence |
|---|---|
| Source revision | Fixes are pinned to `7eb4c1a092f4797dac3a34dfcaea947c98e37f95`; no gate was lowered. |
| Local stock tests | **PASS:** Windows, Node `v24.20.0`, `npm test`, exit 0, 7m06.49s; `.replica/logs/final-integrated-test.log`, SHA-256 `6956D8C391A7826ED3C51F2D5F01301A856CA453E14ABEAD955724546D4C02A5`. This run preceded a diagnostic-only wording edit; the focused suite below passed afterward. |
| Preflight guard | **PASS red/restore/green:** disabling the guard restored the original null-`toFixed` failure; exact original bytes were restored; focused regressions passed afterward. `.replica/logs/core-regressions-post-mutation.log`, SHA-256 `9D58A9F704B27DB8C7BCFAD0D6616D9C5A0B686C0C70442504023216FEB27D24`. |
| Raster controls | **PASS:** missing canvas motion scores 0; missing motion at the far edge of a 1200×200 frame scores 0; same motion with a full-canvas static rebrand has an under-gate pixel score but motion 100; opposite-phase fade has footprint 100%, direction 10.2%, motion 55.09 and fails the 85 gate. See the [core fix report](https://github.com/joelfuller2016/knowledge-Thoughts/blob/main/development-workspace/orchestration/question-team/reports/20261108-replica-core-fix.md) and ignored `.replica/regressions/` artifacts. |
| Static image controls | **PASS:** image capture exits 0; `structure` default/custom compare exits 2 before creating round/history/custom output; faithful mismatch exits 1 at pixel 0 against gate 85. `.replica/qa/static-image-controls-20261108/results.json`, SHA-256 `E0496F0FC1A29530F271A7F5F13AA4D72F55D67CF3DC428573CB469483573454`. See the [independent QA checks](../verification/2026-11-08-fixed-qa.md#independent-qa-checks). |
| Skill compatibility | **PASS:** local validator printed `Skill is valid!`; read-only native project-scope discovery found one enabled `repo` skill with zero parser errors. This does not prove current-chat catalog refresh or body invocation. See the QA note’s [native discovery details](../verification/2026-11-08-fixed-qa.md#independent-qa-checks). |
| Hosted CI | **PASS:** [run 42486495009](https://github.com/joelfuller2016/replica/actions/runs/42486495009), exact code pin; Ubuntu/Windows × Node 20/24, all four `npm test` jobs succeeded. Filtered receipt checked at 2026-11-08 13:50:56 UTC; SHA-256 `BFB9015A217C844B666B4CD517254077A1F67FC1C90CC3431C4EE72B9058279B`. |
| AIApply live trial | **PASS:** reference capture exits 0 with the H1 visible; the same-target faithful comparison exits 0 at score 100, with layout/style/pixels 100 at 1440×900 and 390×844. Repeat screenshots are byte-identical at both sizes. The same-selector synthetic negative returns `NOT YET`, exit 1, score 0; desktop diff 99.98%, mobile 100%; style is unscored and motion was not measured (`--motion 0`). See the [AIApply public heading trial result summary](../trials/2026-11-08-aiapply.md#result-summary). |

## Linked records

- [Fixed QA note](../verification/2026-11-08-fixed-qa.md): source correction chronology, regression evidence, static image controls, metadata and native discovery, with remaining limits.
- [AIApply public heading trial](../trials/2026-11-08-aiapply.md): commands, viewport results, hashes, and boundaries for the anonymous still-capture trial.

The work is complete at the pinned code revision. Motion on AIApply was not tested, and this trial does not establish whole-site or product acceptance.
