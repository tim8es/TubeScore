# TubeScore MVP Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first testable TubeScore vertical slice that converts YouTube metadata into a deterministic movie/TV match decision and renders a rating card, without LLM/CV or bundled secrets.

**Architecture:** Keep recognition as pure TypeScript modules and the UI as a small DOM renderer. The first slice uses in-memory catalog candidates supplied by tests; TMDB network integration follows as a separate task so matching quality and UI behavior remain independently testable.

**Tech Stack:** TypeScript, Vitest, jsdom, Manifest V3-compatible module layout, plain DOM/CSS.

**Spec:** `docs/superpowers/specs/2026-09-08-tubescore-mvp-design.md`

## Global Constraints

- No LLM, computer vision, audio recognition, or subtitle semantic analysis in MVP.
- No API secrets committed or bundled.
- Deterministic matching only.
- False negatives are preferable to confident false positives.
- High-confidence threshold: `>= 0.90`.
- Likely threshold: `>= 0.75` and `< 0.90`.
- UI must be renderable independently from provider/network code.

---

## File map

- `package.json` — scripts and dev dependencies.
- `tsconfig.json` — strict TypeScript config.
- `vitest.config.ts` — Vitest + jsdom configuration.
- `.github/workflows/ci.yml` — install, typecheck, test.
- `src/core/types.ts` — shared recognition types.
- `src/core/normalize.ts` — title normalization.
- `src/core/query-builder.ts` — deterministic query candidates from YouTube metadata.
- `src/core/candidate-scorer.ts` — deterministic confidence score with reasons.
- `src/core/match-decision.ts` — high/likely/no-match decision.
- `src/ui/rating-card.ts` — DOM renderer for recognized media.
- `src/ui/rating-card.css` — minimal card styles.
- `tests/*.test.ts` — focused behavior tests.

### Task 1: Project test harness and RED tests

**Produces:** runnable TypeScript/Vitest project and failing tests that define the first vertical-slice behavior.

- [ ] Add package/test/typecheck configuration and CI.
- [ ] Add failing tests for normalization, scoring, match thresholds, and rating-card rendering.
- [ ] Run CI and confirm failure is caused by missing production modules.

### Task 2: Pure recognition core

**Produces:**
- `normalizeYouTubeTitle(input: string): string`
- `buildSearchQueries(context: YouTubeVideoContext): string[]`
- `scoreCandidate(context: YouTubeVideoContext, candidate: CatalogCandidate): MatchScore`
- `decideMatch(score: MatchScore): MatchDecision`

- [ ] Implement types and title normalization.
- [ ] Implement query generation.
- [ ] Implement deterministic score from title similarity/year evidence with collision penalties.
- [ ] Implement `high | likely | hidden` decision thresholds.
- [ ] Run tests and typecheck.

### Task 3: Testable rating card

**Produces:** `renderRatingCard(result: RecognitionResult): HTMLElement`.

- [ ] Render title, year, media type, confidence label, and ratings.
- [ ] Keep renderer provider-agnostic and network-free.
- [ ] Verify hidden/likely/high presentation through jsdom tests.
- [ ] Run full tests and typecheck.

### Task 4: First provider integration

**Produces:** TMDB catalog adapter behind `CatalogProvider` with mocked integration tests.

- [ ] Add runtime config that reads a developer-supplied token without committing it.
- [ ] Implement movie/TV search mapping into `CatalogCandidate`.
- [ ] Add provider error normalization.
- [ ] Keep rating retrieval separate.

### Task 5: YouTube content-script wiring

**Produces:** watch-page metadata extraction and SPA-safe mount/unmount.

- [ ] Extract video id/title/description/channel.
- [ ] Detect YouTube SPA navigation.
- [ ] Connect metadata to service-worker lookup.
- [ ] Mount rating card near title/actions area.
- [ ] Ignore stale responses after navigation.

### Task 6: End-to-end unpacked extension smoke test

- [ ] Add `manifest.json`, extension build output, and local load instructions.
- [ ] Load unpacked extension in Chromium.
- [ ] Verify known trailer, ambiguous title, and non-film video cases.
- [ ] Record observed matches/misses and tune thresholds only from fixture evidence.
