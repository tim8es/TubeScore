# Candidate selection experiment: entity/cross-query consensus

Base: `main@3359c2e502370eb6a414b564ebd7b7cc3d2ad12c`

## Previous candidate: DROP

The rejected title-only evidence gate is recorded as **DROP** and must not be promoted or reused:

- wrong-title visible: `6 -> 0`
- correct positives: `3/16 -> 1/16`
- adversarial hidden: `7/8 -> 8/8`
- no PR

Reason: it improved precision by suppressing wrong entities but damaged recall too much.

## Preregistered candidate: entity/cross-query consensus

This rule was fixed before production code changes and before after-metrics were collected.

1. Exact Wikidata `P1651` YouTube-ID matching remains authoritative and is outside title-fallback consensus.
2. Title fallback evaluates every request from the existing `buildLocalizedSearchRequests` plan; the first `likely`/`high` request must not terminate selection.
3. One best scored candidate is taken from each deduplicated request signature `(normalized query, language)`. Two supports are independent when either the normalized query differs or the language differs. This combines clean, year-qualified, and localized searches without entity/title allowlists.
4. Supports are aggregated strictly by Wikidata `providerId`.
5. Explicit-year rule: when the context supplies one explicit year, a candidate with a known different `releaseYear` is ineligible. A visible winner must contain a `year-match` support plus at least one additional independent support for the same `providerId`.
6. No-explicit-year rule: a visible winner needs at least two independent supports for the same `providerId`. The only exception is a true singleton request plan after deduplication; with exactly one planned request, the existing decision for that request is preserved because cross-query evidence does not exist.
7. Winner ordering is deterministic: independent support count, then presence of `year-match`, then maximum confidence. A remaining tie between different provider IDs has no visible winner.
8. No case-specific allowlists or provider IDs may appear in production selection logic.

## Preregistered affected benchmark and gate

Languages: EN / ES / PT / RU / IT.

Positive title-fallback cases: 20 (four per language from the existing live multilingual benchmark).

Metrics:

- `recall = correct visible positives / 20`
- `precision = correct visible positives / (correct visible positives + wrong-entity visible positives + visible adversarial negatives)`
- adversarial metric = number of negative/collision cases that remain hidden or return no result.

PASS required, on the same affected benchmark against `main@3359c2e502370eb6a414b564ebd7b7cc3d2ad12c`:

- `precision_after > precision_main`, and
- `recall_after > recall_main`, and
- adversarial hidden count is not lower than main.

If both precision and recall do not improve strictly, this candidate is **DROP** and no PR is opened.

## Result: DROP

Fresh affected benchmark, identical 20 positive + 9 adversarial cases:

| Metric | main baseline | entity consensus | Delta |
| --- | ---: | ---: | ---: |
| Correct visible positives | 5/20 | 4/20 | -1 |
| Wrong-entity visible positives | 6 | 4 | -2 |
| Adversarial hidden | 8/9 | 8/9 | 0 |
| Precision | 0.4167 | 0.4444 | +0.0277 |
| Recall | 0.25 | 0.20 | -0.05 |

The candidate improves precision but reduces recall, so it fails the preregistered simultaneous-improvement gate and is **DROP**. No PR is opened and this rule must not be promoted.

Benchmark evidence:

- baseline run: `34723824105`, job `103634333504`
- candidate run: `34724115513`, job `103635123167`

Test evidence:

- RED before implementation: CI `34723886650`; six prior wrong-title regressions failed while five correct title-only regressions passed.
- targeted candidate regressions after implementation: `11/11` passed in run `34724115513`.
- full suite on candidate: typecheck passed, but `171/175` tests passed and `4/175` failed in CI `34724026106`.
- two full-suite failures are substantive recall regressions (`Onslaught` becomes hidden; a later correct-year Onslaught candidate becomes hidden); two are changed-query-count/order expectations caused by evaluating all consensus requests.

No browser smoke was run. Chrome Web Store was not touched.

## Scope constraints

- Do not return to year-fallback or the rejected title-only gate.
- No allowlists.
- No browser smoke.
- No Chrome Web Store work.
