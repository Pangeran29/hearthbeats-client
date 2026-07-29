---
version: 1
slug: "src-app-live-tracking-imei-page-tsx"
primary_target: "src/app/live-tracking/[imei]/page.tsx"
related_targets: ["src/app/live-tracking/[imei]/history/page.tsx"]
---

## Scope

Operate-mode customer experience covering the default Live route and its related History and Service screens.

## Audience And Job

A motorcycle owner arrives from Telegram on a phone and needs to locate their single motorcycle, verify data freshness, or review its route for a selected date range.

## Structure

- Live is the default destination.
- Persistent bottom navigation contains Live, History, and Service.
- Live prioritizes the latest marker, freshness, battery state, a time-aware customer greeting, daily distance, moving time, average speed, and the latest coordinates.
- History uses start and end dates, maps them to complete WIB days, and shows route metrics and a selectable point timeline.
- Service shows total tracked GPS distance, progress toward the next 1.000 km milestone, interval-based recommendations, and the latest 20 milestones.
- Details live in a draggable sheet that preserves map context at every snap point.

## Direction

Calm Roadbook combines Concept 1's clear map hierarchy and sheet structure with Concept 2's warm paper neutrals, route-orange emphasis, strong numerals, and journey-log character. Texture is restrained; fake license plates and retro ornament are excluded.

## States

Initial loading, live refresh warning with last-known data preserved, stale location, offline device, no position, empty history, empty service milestones, invalid date range, and API failure.

## Constraints

- One customer, one motorcycle, one device.
- Mobile-first web with a centered mobile canvas on desktop.
- Keep map attribution visible.
- IMEI must not become the authorization mechanism.
- Desktop presentation uses a tested 480px maximum-width customer canvas.
