# TubeScore MVP Design

## Purpose

TubeScore is a Chrome/Chromium extension that detects when a YouTube video is meaningfully about a specific movie or TV series and displays rating information directly on the YouTube watch page.

The first release targets official and unofficial trailers, teasers, clips, and reviews. It does not attempt universal scene recognition or frame/audio understanding.

## MVP success criteria

A user opens a supported YouTube watch page and, when TubeScore can identify a movie or TV series with sufficient confidence, sees a compact TubeScore overlay with:

- canonical title;
- release year;
- media type (`movie` or `tv`);
- poster thumbnail when available;
- one or more available ratings;
- recognition confidence state.

The extension must avoid showing a confidently wrong title. False negatives are preferable to false positives in the MVP.

## Scope

### Included

- Chrome/Chromium Manifest V3 extension.
- YouTube watch pages.
- Metadata extraction from YouTube DOM/page state.
- Detection from title, description, channel name, hashtags, and structured text that is already present on the page.
- Candidate generation for movies and TV series through TMDB.
- Deterministic candidate scoring and confidence thresholds.
- Rating-provider abstraction independent from title identification.
- TMDB rating as the baseline rating source.
- Ability to add IMDb/Rotten Tomatoes-compatible providers later without changing the detection pipeline.
- Caching of successful lookups and negative results.
- Loading, matched, ambiguous, no-match, and provider-error UI states.
- Unit tests for parsing, normalization, scoring, and provider adapters.

### Explicitly excluded from MVP

- Computer vision over video frames.
- Audio fingerprinting.
- Speech-to-text or subtitle semantic analysis.
- LLM calls for normal recognition.
- Kinopoisk integration.
- Cross-browser packaging beyond Chromium-compatible browsers.
- User accounts, synchronization, cloud history, recommendations, or social features.
- Scraping IMDb, Rotten Tomatoes, or other sites.

## Key product decision

TubeScore uses the "B" recognition model: support official and unofficial trailers, teasers, clips, and reviews, but only display a result when the system has enough evidence that the YouTube video refers to a specific movie or TV series.

## Recognition policy

Recognition is confidence-based.

Initial thresholds:

- `confidence >= 0.90`: show the result automatically as a high-confidence match.
- `0.75 <= confidence < 0.90`: show a visually softer `Likely` state.
- `confidence < 0.75`: do not show a title/rating card.

These thresholds are configuration values, not hard-coded business logic.

The scoring model should be deterministic in MVP so it can be inspected, tested, and tuned from real examples.

## High-level data flow

```text
YouTube watch page
    ↓
PageMetadataExtractor
    ↓
VideoContextNormalizer
    ↓
QueryCandidateBuilder
    ↓
CatalogProvider (TMDB)
    ↓
CandidateScorer
    ↓
MatchDecision
    ↓
RatingsProvider[]
    ↓
TubeScore overlay
```

## Architecture

### 1. Content script

Responsibilities:

- detect YouTube SPA navigation;
- read current video metadata from the page;
- mount/unmount the TubeScore UI;
- send lookup requests to the extension service worker;
- render lookup states.

It must not contain provider credentials or provider-specific search logic.

### 2. Service worker

Responsibilities:

- orchestrate recognition;
- call catalog/rating providers;
- enforce caching;
- normalize provider errors;
- return a single serializable `RecognitionResult` to the content script.

This keeps network logic separate from YouTube DOM logic.

### 3. YouTube metadata extraction

The extractor produces:

```ts
export interface YouTubeVideoContext {
  videoId: string;
  title: string;
  description: string;
  channelName: string;
  hashtags: string[];
  url: string;
}
```

Extraction must tolerate delayed rendering and YouTube SPA navigation.

### 4. Normalization and query building

The normalizer removes low-signal trailer/review noise while preserving title information.

Examples of removable tokens or patterns:

- official trailer;
- teaser;
- trailer 1 / trailer 2;
- 4K / HD;
- reaction;
- review;
- ending explained;
- studio/channel boilerplate;
- release-date fragments when used only as promotion text.

The query builder may emit multiple candidate queries from one YouTube title, for example:

```text
"Dune: Part Two | Official Trailer 3"
→ "Dune: Part Two"
→ "Dune Part Two"
```

### 5. Catalog provider abstraction

```ts
export type MediaType = 'movie' | 'tv';

export interface CatalogCandidate {
  providerId: string;
  mediaType: MediaType;
  title: string;
  originalTitle?: string;
  releaseYear?: number;
  overview?: string;
  popularity?: number;
  posterUrl?: string;
  externalIds?: {
    imdb?: string;
  };
}

export interface CatalogProvider {
  search(query: string): Promise<CatalogCandidate[]>;
}
```

MVP implementation: `TmdbCatalogProvider`.

TMDB is appropriate for candidate discovery because its API supports movie/TV text search and external IDs including IMDb identifiers. TMDB authentication is application-level via API key or bearer token. The extension architecture must keep the authentication mechanism replaceable and must not commit secrets to Git.

### 6. Candidate scoring

Candidate scoring is local and deterministic.

Signals should include:

- normalized title exact/near-exact match;
- original title match;
- explicit year match when present in the YouTube metadata;
- movie/TV intent words;
- title token coverage;
- channel/studio hints;
- TMDB popularity only as a weak tie-breaker;
- penalties for sequel/year mismatch;
- penalties for weak short-title collisions.

Popularity must never dominate title evidence.

Proposed shape:

```ts
export interface MatchScore {
  candidate: CatalogCandidate;
  confidence: number;
  reasons: string[];
}
```

The scorer returns normalized confidence in `[0, 1]` plus human-readable reasons for debugging.

### 7. Rating provider abstraction

Title identification and rating retrieval are separate concerns.

```ts
export interface RatingValue {
  source: string;
  value: number;
  scale: number;
  voteCount?: number;
  url?: string;
}

export interface RatingsProvider {
  getRatings(candidate: CatalogCandidate): Promise<RatingValue[]>;
}
```

MVP baseline provider:

- TMDB vote average/vote count.

Future providers can use the IMDb external ID returned through the catalog mapping.

The implementation must not scrape IMDb or Rotten Tomatoes pages. Any additional provider must be reviewed for API availability, data rights, caching rules, attribution requirements, and commercial-use constraints before production use.

### 8. Cache

Use `chrome.storage.local` for MVP.

Suggested cache keys:

```text
recognition:<youtubeVideoId>
catalog:<normalizedQuery>
ratings:<provider>:<mediaType>:<providerId>
```

Suggested TTLs:

- successful recognition: 7 days;
- catalog candidate search: 7 days;
- ratings: 24 hours;
- no-match result: 24 hours.

Cache format includes a schema version so future releases can invalidate stale entries safely.

### 9. UI

The MVP UI is a compact card mounted near the YouTube title/actions area rather than over the video itself. This avoids blocking controls and reduces breakage across theater/fullscreen modes.

States:

- hidden/no-match;
- loading;
- high-confidence match;
- likely match;
- provider unavailable;
- partial ratings available.

High-confidence example:

```text
TubeScore
Dune: Part Two (2024)
TMDB 8.1/10
```

Likely matches show a clear `Likely` label instead of pretending certainty.

## YouTube SPA behavior

YouTube navigates between videos without a full page reload. The content script must listen for navigation changes and re-run extraction when the video ID changes.

Recognition requests must be cancellable/ignorable by generation ID so a slow response for video A cannot overwrite the UI after the user has already navigated to video B.

## Error handling

Errors are normalized into categories:

```ts
export type RecognitionErrorCode =
  | 'metadata_unavailable'
  | 'catalog_unavailable'
  | 'ratings_unavailable'
  | 'rate_limited'
  | 'invalid_configuration';
```

Provider failures must not break YouTube or leave an intrusive error banner. TubeScore should silently hide or show a compact degraded state depending on whether a title match was already obtained.

## Security and privacy

- Do not collect YouTube history on a remote backend in MVP.
- Do not send page content anywhere except configured catalog/rating APIs required for recognition.
- Do not commit API tokens or keys.
- Request the minimum Chrome permissions required.
- Avoid broad host permissions where narrower provider origins are sufficient.
- Store only recognition/cache data locally.

## API-key strategy

The MVP should support local developer configuration without checking credentials into source control.

Production distribution must not depend on a secret that can be safely hidden inside the extension bundle, because extension code is inspectable by users. Before public release, choose one of:

1. a provider/API model where a public client credential is acceptable and constrained;
2. a minimal TubeScore backend/proxy that keeps server-side secrets and applies rate limiting;
3. a provider designed for unauthenticated/public browser usage.

This decision is deliberately postponed until the recognition MVP proves useful.

## Technology choices

Recommended stack:

- TypeScript;
- Chrome Extension Manifest V3;
- Vite for build tooling;
- Vitest for unit tests;
- plain DOM/CSS for the first overlay instead of React;
- ESLint + TypeScript strict mode.

Rationale: the MVP UI is small, so a framework adds bundle and lifecycle complexity without meaningful product value. The architecture keeps UI code isolated so React or another renderer can be introduced later if the surface grows.

## Proposed source structure

```text
src/
  background/
    service-worker.ts
    recognition-orchestrator.ts
  content/
    content-script.ts
    youtube-navigation.ts
    youtube-metadata.ts
  core/
    normalize.ts
    query-builder.ts
    candidate-scorer.ts
    match-decision.ts
    types.ts
  providers/
    catalog-provider.ts
    tmdb/
      tmdb-client.ts
      tmdb-catalog-provider.ts
    ratings-provider.ts
    tmdb/
      tmdb-ratings-provider.ts
  storage/
    cache.ts
  ui/
    rating-card.ts
    rating-card.css
  config/
    thresholds.ts
    runtime-config.ts

tests/
  normalize.test.ts
  query-builder.test.ts
  candidate-scorer.test.ts
  match-decision.test.ts
  youtube-metadata.test.ts
  providers/
```

## Testing strategy

### Unit tests

Use a fixture corpus that covers:

- official trailers;
- unofficial trailer uploads;
- teasers;
- clips;
- reviews;
- sequel collisions;
- remakes with the same title;
- short ambiguous titles;
- unrelated videos containing a film name incidentally;
- movie/TV title collisions.

Primary metric during MVP development: false-positive rate on the fixture corpus.

### Integration tests

Provider clients use mocked network responses. Recognition orchestration is tested from a `YouTubeVideoContext` input to a `RecognitionResult` output.

### Manual smoke test

Load the unpacked extension in Chromium and verify a small fixed set of public YouTube examples. Manual examples are documentation/evaluation inputs, not unit-test dependencies.

## MVP acceptance criteria

1. Extension loads in current Chromium browsers using Manifest V3.
2. YouTube SPA navigation between videos does not require page refresh.
3. Known trailer fixtures produce the expected movie/TV match.
4. Ambiguous/unrelated fixtures stay below display threshold.
5. A successful match displays a compact card without obstructing YouTube controls.
6. TMDB provider/network errors do not break page interaction.
7. No API secrets exist in committed source.
8. Recognition logic, provider logic, and UI logic remain independently testable.

## Deferred product decisions

After the first recognition prototype is measured, decide:

- whether `Likely` results should be user-confirmable;
- whether to add optional subtitle/description expansion for difficult cases;
- which licensed source to use for IMDb and Rotten Tomatoes ratings;
- whether a TubeScore backend is necessary;
- whether to support Firefox/Safari;
- whether to add Kinopoisk for region-specific editions.

## Current external API evidence

As of 2026-09-08, TMDB documents application-level authentication, movie search, and movie external IDs including IMDb identifiers. This supports using TMDB as the MVP catalog/mapping layer while keeping ratings as a separate provider concern.
