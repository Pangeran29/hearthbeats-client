# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Heartbeats serves Indonesian motorcycle owners who use a GPS tracker installed on their motorcycle. Customers primarily open the website from a link delivered through Telegram. In the current product model, one customer can have one motorcycle and one GPS device.

## Product Purpose

Heartbeats gives a customer a focused mobile web experience for checking their motorcycle's location. The first redesigned release must support two primary jobs:

- See the motorcycle's live location and receive current tracking updates.
- Review tracking data within a customer-selected date range.

Success means a customer can open the Telegram link on a phone, understand where the motorcycle is, understand how recent the information is, and inspect a selected tracking period without navigating an operational dashboard.

## Positioning

Heartbeats combines a motorcycle-installed GPS tracker, Telegram-delivered access, and a focused customer map experience. The customer interface is intentionally limited to the customer's own motorcycle instead of exposing fleet-management concepts.

## Operating Context

- Customers normally enter from Telegram rather than navigating from a public website.
- The Telegram link opens the Live screen by default.
- The primary device is a phone used in portrait orientation.
- The website may be opened on desktop, but the customer experience remains a centered, mobile-width application instead of expanding into a desktop dashboard.
- Live tracking and tracking history are separate screens available from persistent navigation.
- Tracking history uses a date-range input rather than requiring customers to enter exact start and end times.
- Location freshness and the selected date range must remain clear while the customer interacts with the map.

## Capabilities and Constraints

- One customer maps to one motorcycle and one GPS device.
- The first redesign focuses on separate Live and History screens.
- Live is the default screen after a customer opens the website.
- History accepts a start date and end date. The implementation must translate those dates into complete WIB calendar-day boundaries for the API.
- The first release displays last update time, speed, route distance, a location-point timeline, coordinates, and GPS signal information.
- The product remains a website and must be designed mobile-first.
- Desktop presentation must preserve the mobile application composition in a centered, width-constrained viewport.
- Existing GPS data and backend APIs remain the functional starting point.
- The current route accepts an IMEI in the URL. The future Telegram-link authentication and authorization mechanism is an open decision and must prevent customers from accessing another customer's device.
- The exact maximum width used for the centered desktop presentation is an open design decision.

## Brand Commitments

- Preserve the Heartbeats product name.
- Customer-facing language should be direct and understandable to motorcycle owners.
- Do not expose internal operations terminology in the customer experience.

## Evidence on Hand

- Existing marketing page: `src/app/page.tsx`
- Existing live tracking route: `src/app/live-tracking/[imei]/page.tsx`
- Existing live tracking UI: `src/components/live-tracking-viewer.tsx`
- Existing map implementation: `src/components/history-map.tsx`
- Existing GPS API adapter: `src/lib/gps-history.ts`
- Existing Rust GPS and subscription backend in the sibling `gt06n-tcp-server` repository
- User-provided desktop reference showing a centered, width-constrained mobile website

No approved consumer design system, production authentication flow, or complete redesigned screen set exists yet.

## Product Principles

- Put location and data freshness before secondary information.
- Keep the common mobile tracking path short and obvious.
- Preserve the same focused mobile composition on larger screens.
- Show only the signed-in customer's motorcycle.
- Load and present only the tracking period needed for the customer's current task.
