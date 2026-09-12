# TubeScore Privacy Policy

_Last updated: September 12, 2026_

TubeScore is a Chrome/Chromium extension whose single purpose is to identify movies or TV series referenced by YouTube videos and display relevant ratings next to the YouTube video metadata.

## Data TubeScore handles

TubeScore processes information from the YouTube page you are viewing so it can identify the referenced movie or TV series. This includes the current YouTube video identifier and page metadata used to derive a media-search query.

To provide ratings, TubeScore sends the YouTube video identifier and/or derived media-search terms to the public Wikidata Action API over HTTPS. TubeScore then requests structured Wikidata entity and rating data needed to render the result.

TubeScore stores only your selected rating-source preferences in `chrome.storage.local` on your device.

## What TubeScore does not collect

TubeScore does not operate a developer analytics or tracking backend and does not collect or retain your browsing history, identity, email address, authentication data, payment information, or advertising identifiers on developer-controlled servers.

TubeScore does not sell user data, use user data for advertising, build advertising profiles, or transfer user data to data brokers.

## Third-party services

TubeScore communicates with Wikidata (`www.wikidata.org`) only to provide its user-facing identification and rating features. Wikidata receives normal HTTPS request information plus the query parameters needed to perform the lookup. Wikimedia's own privacy and data-handling practices apply to those requests.

When you explicitly click a rating card that has a validated external destination, your browser opens the relevant third-party rating service. That navigation is initiated by you and is governed by the destination service's own privacy policy.

## Permissions

TubeScore requests:

- `storage` — only to save the list of rating sources you have enabled;
- access to `https://www.wikidata.org/*` — only to query the public Wikidata API;
- a content script on `https://www.youtube.com/*` — only to read the page context required to identify the movie or TV series and render the TubeScore UI on YouTube.

TubeScore does not request `tabs`, `history`, or `cookies` permissions.

## Retention and deletion

Rating-source preferences remain in Chrome extension-local storage until you change them, clear extension data, or uninstall TubeScore. The developer does not receive or retain a copy of those preferences.

The standard production extension does not persist Wikidata lookup results to disk; its provider cache is in memory and is discarded when the Manifest V3 service worker restarts.

## Security

Requests to Wikidata use HTTPS. TubeScore does not ship API credentials, remote executable code, analytics SDKs, or advertising SDKs in the standard production build.

## Chrome Web Store Limited Use

TubeScore uses data accessed through Chrome only to provide or improve its disclosed single-purpose, user-facing functionality. TubeScore's use of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Changes

If TubeScore's data practices materially change, this policy and the Chrome Web Store privacy disclosures will be updated before the changed behavior is released.

## Contact

Privacy and support questions can be filed publicly in the TubeScore GitHub issue tracker:

https://github.com/tim8es/TubeScore/issues
