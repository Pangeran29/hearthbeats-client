---
name: Heartbeats Calm Roadbook
description: A calm map-first motorcycle tracking system with warm roadbook character.
colors:
  route-orange: "#E4512B"
  route-orange-deep: "#B73A20"
  warm-canvas: "#F4F1EA"
  paper-surface: "#FFFDF8"
  quiet-surface: "#F8F5EF"
  charcoal-ink: "#20231F"
  muted-ink: "#6B6E68"
  quiet-border: "#DDD8CE"
  live-green: "#168B52"
  warning-amber: "#B97316"
  alert-red: "#C83E32"
typography:
  headline:
    fontFamily: "Barlow, sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Barlow, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "Barlow, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Barlow, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.01em"
  metric:
    fontFamily: "Barlow Semi Condensed, Barlow, sans-serif"
    fontSize: "32px"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "-0.02em"
rounded:
  control: "10px"
  card: "14px"
  sheet: "24px"
  circular: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.route-orange}"
    textColor: "{colors.paper-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.charcoal-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  date-field:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.charcoal-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px"
    height: "48px"
  bottom-sheet:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.charcoal-ink}"
    rounded: "{rounded.sheet}"
    padding: "12px 16px 16px"
---

# Design System: Heartbeats Calm Roadbook

## Overview

**Creative North Star: "The Calm Roadbook"**

Heartbeats combines the interaction clarity of a modern map utility with the warmth and specificity of a rider's roadbook. The map remains the dominant working surface; typography, controls, sheets, and timelines provide orientation without competing with it. The system should feel dependable enough for a safety product and distinct enough to belong to motorcycle owners rather than a generic fleet dashboard.

Roadbook character comes from warm paper neutrals, route-orange wayfinding, concise journey-log structure, and strong numerical typography. It does not come from fake license plates, distressed decoration, nostalgic costume, or heavy texture.

**Key Characteristics:**

- Map-first and immediately understandable.
- Warm, restrained surfaces with one route-orange accent.
- Clear location freshness and semantic safety states.
- Large readable metrics and compact journey-log details.
- Mobile composition preserved on every viewport.

## Colors

The palette uses warm paper neutrals and charcoal ink, with orange reserved for navigation, route emphasis, and primary action.

### Primary

- **Route Orange** (`#E4512B`): Motorcycle marker, route line, selected navigation, and primary actions.
- **Deep Route Orange** (`#B73A20`): Pressed and high-contrast orange states.

### Neutral

- **Warm Canvas** (`#F4F1EA`): Desktop gutters and non-map application background.
- **Paper Surface** (`#FFFDF8`): Bottom sheets, navigation, controls, and primary content surfaces.
- **Quiet Surface** (`#F8F5EF`): Secondary metric and timeline backgrounds.
- **Charcoal Ink** (`#20231F`): Primary text and icons.
- **Muted Ink** (`#6B6E68`): Metadata, inactive navigation, and helper text.
- **Quiet Border** (`#DDD8CE`): Field outlines and restrained dividers.

### Semantic

- **Live Green** (`#168B52`): Verified live location and healthy connection only.
- **Warning Amber** (`#B97316`): Stale data and recoverable tracking warnings.
- **Alert Red** (`#C83E32`): Offline, failed, or security-critical states.

**The Route Is Orange Rule.** Orange communicates movement, selection, or an intentional customer action. It is not a decorative fill for large surfaces.

**The Semantic Color Rule.** Green, amber, and red describe system truth only. They never become brand decoration.

## Typography

**Display and Body Font:** Barlow with system sans-serif fallback  
**Metric Font:** Barlow Semi Condensed with Barlow fallback

**Character:** Barlow provides approachable road-sign clarity and strong numerals without turning the interface into a technical dashboard. The semi-condensed metric treatment gives speed, distance, and point counts presence while conserving mobile width.

### Hierarchy

- **Headline** (650, 24px, 1.15): Screen identity and important vehicle state.
- **Title** (600, 18px, 1.25): Sheet and section titles.
- **Body** (400, 15px, 1.45): Controls, timeline content, and general UI copy.
- **Label** (500, 12px, 1.3): Metadata, units, and freshness details.
- **Metric** (650, 32px, 1): Speed, distance, peak speed, and point counts.

**The Read It Outdoors Rule.** No essential customer-facing text renders below 12px. Map overlays and metadata use sufficient weight and contrast for daylight use.

## Layout

The application fills the available phone viewport and remains a centered mobile canvas on wider screens. The production maximum width is provisionally `480px`; desktop space outside the application uses Warm Canvas and does not introduce a desktop-specific layout.

The map owns the primary viewport. A compact safe-area header floats or sits above it, and a draggable bottom sheet reveals details while maintaining visibility of the selected motorcycle or route. Persistent navigation contains exactly two primary destinations: Live and History.

Spacing follows a 4px base rhythm. Primary screen edges use 16px padding. Common internal gaps use 8px or 12px; distinct sections use 16px or 24px. Controls are at least 44px tall, with 48px as the standard.

The map camera must account for the sheet's current snap point, navigation safe area, attribution, and floating controls. Desktop centering must never change map proportions or information hierarchy.

## Elevation & Depth

The system is flat by default and uses tonal separation before shadow. The bottom sheet, floating location control, and map status chip may use a soft ambient shadow to remain legible over changing map content. Avoid stacked translucent cards and deep dashboard shadows.

**The Map Context Rule.** Any floating surface must preserve enough map context to understand the vehicle or route position.

## Shapes

Controls use 10px corners, content cards use 14px corners, and the draggable sheet uses 24px top corners. Circular controls are reserved for map actions and point markers. Inner radii remain smaller than their containers.

Roadbook character may use fine dividers, compact journey-log rows, and restrained notched details in nonessential decoration. Do not use fake license-plate containers or distressed edges for core controls.

## Components

### Header

- Compact, safe-area aware, and subordinate to the map.
- Shows Heartbeats and the customer's single motorcycle without a device-switching affordance.
- Live freshness appears close to the map rather than as a marketing badge.

### Map

- Uses a muted, warm-neutral basemap so the orange route and motorcycle marker dominate.
- Keeps legal attribution visible above the lowest sheet position.
- Provides one thumb-friendly recenter control.
- Start, end, latest, and selected points remain visually distinct without a dense marker cloud.

### Bottom Sheet

- Three interaction states may be used: collapsed summary, medium details, and expanded timeline.
- Tracks the pointer directly while dragged and settles to snap points with an interruptible spring.
- Keeps the selected motorcycle or route point visible by adjusting map padding.
- Uses Paper Surface with minimal ambient shadow and a visible grabber.

### Buttons

- **Shape:** 10px radius, minimum 44px height, standard 48px.
- **Primary:** Route Orange with Paper Surface text.
- **Secondary:** Paper Surface with Charcoal Ink and Quiet Border.
- **Pressed:** Immediate `scale(0.98)` feedback and Deep Route Orange where applicable.
- **Focus:** Visible high-contrast outline; never rely on color alone.

### Date Fields

- Use native date input behavior where practical.
- Present start and end dates as one understandable date-range group.
- Do not require time input in the first release.
- Error copy appears inline and preserves the map.

### Metrics

- Large Semi Condensed numerals with smaller units.
- Use tabular numerals.
- Avoid placing every metric in a separate elevated card; grouping and dividers are preferred.

### Timeline

- Reads like a journey log rather than a table.
- Each row shows WIB time, speed, coordinates, and satellite count.
- Tapping a row selects and focuses the corresponding map point.
- Selected state uses a restrained orange indicator without recoloring the entire row.

### Navigation

- Exactly two destinations: Live and History.
- Persistent at the bottom with safe-area padding.
- Active state uses Route Orange and a clear label; inactive state uses Muted Ink.
- Navigation remains stable while the sheet moves.

## Do's and Don'ts

### Do:

- **Do** keep the map and selected location visible while details expand.
- **Do** show exact freshness information instead of an unexplained green dot.
- **Do** use complete WIB calendar-day boundaries for History date ranges.
- **Do** preserve readable text, touch targets, and legal map attribution.
- **Do** use warm roadbook details sparingly to make Heartbeats recognizable.

### Don't:

- **Don't** recreate a desktop dashboard inside a narrow viewport.
- **Don't** use fake license plates, distressed paper, or retro ornament as core UI.
- **Don't** load or render all historical GPS points by default.
- **Don't** expose IMEI-based location access without customer authorization.
- **Don't** use gradients, generic glassmorphism, dark-only presentation, or multiple competing accent colors.
