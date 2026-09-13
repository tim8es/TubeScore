# TubeScore v0.3.1 — non-author utility test packet

Status: **UNEXECUTED**. This packet is prepared for a tester who is not the TubeScore author. Do not mark it PASS until that person returns the completed result block below.

## Build under test

- Production commit: `3359c2e502370eb6a414b564ebd7b7cc3d2ad12c`
- Verified main CI run: `34721979078`
- CI artifact: `TubeScore-MVP-3359c2e502370eb6a414b564ebd7b7cc3d2ad12c`
- Artifact id: `10306213069`
- Artifact SHA-256 wrapper digest: `be64e7078f3fc81aa37c8d644da402fc5c49e97b057f0e7b03bb38ecf8094daa`
- Actions run: https://github.com/tim8es/TubeScore/actions/runs/34721979078

Use exactly that artifact, or check out exactly that commit and run `npm install --no-audit --no-fund && npm run build`. Do not test a later branch or experimental build.

## Install

1. Extract the downloaded artifact and the contained TubeScore archive until you have a directory containing `manifest.json`, `content-script.js`, `service-worker.js`, and `assets/`.
2. Open `chrome://extensions` in Chrome/Chromium.
3. Enable **Developer mode** → **Load unpacked** → choose that directory.
4. Confirm TubeScore loads without an extension error banner.

## Five-minute utility check

Do the steps in order. Do not inspect source code or Wikidata first; record only what a normal user sees.

### Case A — Russian movie

Open: https://www.youtube.com/watch?v=tTtftyuS680

Record:
- whether a TubeScore card appears;
- displayed title/year if present;
- whether the result is clearly the 2026 `Моана / Moana`, not the 2016 animation;
- whether the card visually overlaps/breaks YouTube controls.

### Case B — English movie

Open: https://www.youtube.com/watch?v=mNd1gb19A-c

Record:
- whether a TubeScore card appears;
- displayed title/year if present;
- whether the result is the 2026 `Resident Evil` film;
- whether ratings/links shown look usable rather than duplicated or broken.

### Case C — ambiguous TV remake

Open: https://www.youtube.com/watch?v=SJVmeJaS44s

Record exactly what TubeScore identifies. The trailer is for the HBO series. If TubeScore identifies the 2001 film, mark this case **FAIL: wrong entity**. If no card appears, record **NO MATCH**, not PASS or FAIL-by-default.

### Case D — source settings

On any visible TubeScore card:
1. Open the gear/source drawer.
2. Disable one currently enabled source.
3. Close/reopen the drawer and confirm the source remains disabled.
4. Reload the YouTube page and confirm the preference still persists.
5. Use **Reset to recommended** and confirm the recommended four-source selection returns.

Record PASS/FAIL for persistence and reset separately.

### Case E — YouTube SPA navigation / stale-card check

Without opening a new browser tab, navigate from Case A or B to another YouTube watch video using normal YouTube navigation, then use Back once.

Record whether:
- the old TubeScore title/card ever remains attached to the new video;
- the card refreshes or disappears rather than showing stale movie data;
- navigation remains usable.

## Copy-paste result block

```text
TubeScore non-author utility test
Tester is not the TubeScore author: YES / NO
Browser + version:
OS:
Build SHA: 3359c2e502370eb6a414b564ebd7b7cc3d2ad12c

A Russian Moana: CARD / NO MATCH / ERROR
A identified title/year:
A correct 2026 entity: YES / NO / N/A
A UI usable: YES / NO

B Resident Evil: CARD / NO MATCH / ERROR
B identified title/year:
B correct 2026 entity: YES / NO / N/A
B ratings/links usable: YES / NO / N/A

C Harry Potter HBO: CARD / NO MATCH / ERROR
C identified title/year/type:
C wrong 2001 film: YES / NO / N/A

D settings persist after reload: PASS / FAIL / NOT RUN
D reset to recommended: PASS / FAIL / NOT RUN

E no stale card across SPA navigation/back: PASS / FAIL / NOT RUN

Any console/extension error shown to user:
Screenshot(s), optional:
Free-form note, max 3 sentences:
```

## Acceptance/read-back rule

This packet itself is **not evidence of utility PASS**. A non-author run is accepted as executed only when the completed result block identifies the exact build SHA and browser/OS and contains outcomes for Cases A–E. Any reproducible wrong entity, stale card, broken settings persistence, or extension error becomes a concrete defect candidate. `NO MATCH` is recorded separately because current product policy intentionally prefers some false negatives over confident false positives.
