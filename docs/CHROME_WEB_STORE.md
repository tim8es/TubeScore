# Chrome Web Store submission sheet

This file is the release-owner source of truth for the first TubeScore Chrome Web Store submission.

## Item identity

**Product name:** TubeScore

**Manifest version:** Manifest V3

**Release version:** 0.2.3

**Primary language:** English

**Suggested category:** choose the closest current Chrome Web Store category to Entertainment / Fun when submitting. Do not guess a category that is not present in the dashboard.

## Store listing copy

### Summary / short description

> See movie and TV ratings directly on YouTube trailers, clips, and reviews with TubeScore.

### Detailed description

> TubeScore adds movie and TV ratings directly to YouTube watch pages.
>
> When you open a trailer, clip, or review, TubeScore uses the current YouTube page context to identify the referenced movie or TV series. It then retrieves structured public rating data from Wikidata and displays available scores in a compact panel next to the YouTube metadata.
>
> By default, TubeScore shows Kinopoisk, IMDb, Rotten Tomatoes, and Metacritic when those ratings are available in Wikidata. Additional rating sources can be enabled from the built-in settings drawer. Your source selection is stored locally in Chrome.
>
> When Wikidata provides a validated platform identifier, a rating card can link directly to the corresponding title page on that rating service.
>
> TubeScore does not require an account, API key, subscription, analytics SDK, advertising SDK, or developer-operated backend. The production extension uses the public Wikidata API and is designed to fail conservatively when a title cannot be identified with sufficient confidence.
>
> Privacy: TubeScore reads only the YouTube page context needed for its visible rating feature, sends the YouTube video identifier and/or derived media-search terms to Wikidata for lookup, and stores only rating-source preferences locally. See the linked privacy policy for full details.

## Single purpose

> TubeScore identifies movies or TV series referenced by YouTube videos and displays relevant ratings and validated title links directly on the YouTube page.

## Permission justifications

### `storage`

> Used only to save the user's enabled rating-source names locally so the same rating-source preferences persist across YouTube pages and browser sessions.

### `https://www.wikidata.org/*`

> Required to query the public Wikidata Action API for movie/TV identification, Wikidata entity data, review-score statements, rating issuers, and exact external platform identifiers used by TubeScore's visible rating feature.

### YouTube content-script access: `https://www.youtube.com/*`

> Required to read the current YouTube page context needed to identify the movie or TV series, render the TubeScore rating panel on the page, and continue working across YouTube single-page-app navigation without requesting access to unrelated websites.

## Privacy practices — conservative disclosure

The dashboard wording can change. Use the closest current options and keep the disclosure at least as broad as the behavior below.

TubeScore **handles current-page browsing/page-content data** because it reads YouTube page context and transmits a YouTube video identifier and/or derived media-search terms to Wikidata to provide the user-facing lookup. If the dashboard offers categories equivalent to **Web history / browsing activity** and **Website content**, disclose them rather than understating the data flow.

For those categories:

- purpose: **App functionality / core feature only**;
- sold to third parties: **No**;
- used for advertising or personalization: **No**;
- used for creditworthiness or lending: **No**;
- developer analytics/tracking: **No**;
- human review of user data: **No**;
- transfer to Wikidata: **Yes, only as necessary to provide the disclosed lookup feature**;
- retained by the developer: **No**.

Local rating-source preferences should be disclosed as local extension settings if the dashboard asks about locally stored user data. They are not sent to the developer.

**Privacy policy URL after this branch is merged:**

https://github.com/tim8es/TubeScore/blob/main/PRIVACY.md

## Remote code / monetization answers

- Executes remote code: **No**.
- Uses a developer-operated backend in the standard production build: **No**.
- Requires an account or login: **No**.
- Contains ads: **No**.
- Uses affiliate links: **No**.
- Contains in-app purchases: **No**.
- Uses analytics or telemetry SDKs: **No**.

## Public URLs

**Homepage / source:** https://github.com/tim8es/TubeScore

**Support:** https://github.com/tim8es/TubeScore/issues

**Privacy policy:** https://github.com/tim8es/TubeScore/blob/main/PRIVACY.md

## Graphic assets

The production ZIP contains extension icons at 16, 32, 48, and 128 px. The 128 px icon is the Chrome Web Store icon.

For the dashboard, prepare separately:

- required store icon: 128×128 PNG — available from `assets/icon128.png` in the release;
- required screenshot: at least one actual 1280×800 or 640×400 screenshot of the final extension running on a live YouTube watch page;
- small promo tile: 440×280 PNG/JPEG;
- marquee promo image: 1400×560 PNG/JPEG, optional unless the current dashboard requires it.

**Do not upload generated UI mockups as product screenshots.** Store screenshots should show the actual current TubeScore build running in Chromium and should match the submitted version.

Recommended screenshot set:

1. final overlay on a recognizable movie trailer with the four default rating sources visible;
2. settings drawer open, showing the four recommended sources enabled and other available sources disabled;
3. a second title showing responsive layout / another rating-source combination, if available.

## Submission gates

Before clicking **Submit for review**:

- Google developer account registration is complete;
- 2-Step Verification is enabled on the publishing Google account;
- Store listing and Privacy tabs are complete;
- the uploaded ZIP is built from the final `main` commit;
- at least one real final-version screenshot is uploaded;
- privacy-policy URL resolves publicly;
- permission justifications match the manifest exactly;
- no generated/mock UI screenshot is presented as actual extension behavior;
- final install smoke has been performed in Chromium from the exact ZIP being submitted.
