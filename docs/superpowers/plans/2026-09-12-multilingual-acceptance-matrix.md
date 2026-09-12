# Multilingual Acceptance Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove and harden TubeScore multilingual recognition across all 13 advertised languages with deterministic acceptance tests, fixing only failures demonstrated by those tests.

**Architecture:** Keep the current zero-token recognition pipeline: exact YouTube ID first, then normalized localized title search against Wikidata, then candidate scoring. Add a table-driven acceptance suite that verifies normalization, language routing, localized provider classification, and end-to-end high-confidence recognition for representative titles in every supported language. Change production code only where the new tests expose real defects.

**Tech Stack:** TypeScript, Vitest, Chrome Manifest V3, Wikidata public API mocks.

**Spec:** Existing TubeScore v0.3.0 multilingual recognition behavior in `src/core/query-builder.ts`, `src/core/normalize.ts`, `src/providers/wikidata/wikidata-multilingual-catalog.ts`, and `src/extension/public-recognition-orchestrator.ts`.

## Global Constraints

- Supported languages: `en`, `ru`, `uk`, `es`, `de`, `fr`, `it`, `pt`, `pl`, `tr`, `ja`, `ko`, `zh`.
- No LLM, translation service, API key, or TubeScore backend.
- No Chrome permission expansion beyond `storage` and `https://www.wikidata.org/*`.
- Exact YouTube-video-ID lookup remains the first recognition path.
- Prefer false negatives over incorrect movie/TV matches.

---

### Task 1: Add a 13-language acceptance matrix

**Files:**
- Create: `tests/multilingual-acceptance-matrix.test.ts`
- Modify only if test failures require it: `src/core/normalize.ts`, `src/core/query-builder.ts`, `src/providers/wikidata/wikidata-multilingual-catalog.ts`, `src/core/candidate-scorer.ts`

**Interfaces:**
- Consumes: `normalizeYouTubeTitle()`, `inferWikidataSearchLanguages()`, `buildLocalizedSearchRequests()`, `WikidataMultilingualCatalogProvider.search()`, `scoreCandidate()`.
- Produces: deterministic regression coverage for all 13 supported languages.

- [ ] **Step 1: Write failing table-driven tests**

Cover at least one representative localized trailer title per language, including movie/TV descriptions and expected first-choice locale. Include ambiguity checks for RU/UK, ES/PT, JA/ZH and Latin-title fallback behavior.

- [ ] **Step 2: Run CI and verify failures are real**

Run the repository CI on the branch. Expected: any unsupported/incorrect normalization, language routing or localized media classification appears as an explicit failing matrix row.

- [ ] **Step 3: Implement minimal fixes only for demonstrated failures**

Adjust localized noise patterns, language markers/order, or localized movie/TV description classification only where an acceptance row fails. Preserve exact-ID priority and existing permissions.

- [ ] **Step 4: Re-run the complete suite**

Expected: all acceptance rows and all pre-existing tests pass; `npm run typecheck` and `npm run verify:build` pass.

- [ ] **Step 5: Commit the verified changes**

Commit test and required minimal production fixes together with a message describing multilingual acceptance hardening.

### Task 2: Release and verify v0.3.1

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `tests/extension/manifest.test.ts`

**Interfaces:**
- Produces: version-aligned installable Chrome extension package.

- [ ] **Step 1: Bump manifest/package/test expectation to `0.3.1`**
- [ ] **Step 2: Run full CI on exact PR head**
- [ ] **Step 3: Merge only after green CI**
- [ ] **Step 4: Verify post-merge `main` CI including package integrity and uploaded artifact**
- [ ] **Step 5: Download and independently inspect the installable ZIP**
