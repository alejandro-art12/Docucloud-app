---
name: Vault Blue
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#4059aa'
  on-secondary: '#ffffff'
  secondary-container: '#8fa7fe'
  on-secondary-container: '#1d3989'
  tertiary: '#485767'
  on-tertiary: '#ffffff'
  tertiary-container: '#606f80'
  on-tertiary-container: '#e9f2ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dce1ff'
  secondary-fixed-dim: '#b6c4ff'
  on-secondary-fixed: '#00164e'
  on-secondary-fixed-variant: '#264191'
  tertiary-fixed: '#d5e4f8'
  tertiary-fixed-dim: '#b9c8db'
  on-tertiary-fixed: '#0e1d2b'
  on-tertiary-fixed-variant: '#3a4858'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-sm:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system defines an enterprise-grade mobile document management environment built on confidence, precision, and structural clarity. It targets professionals, enterprise teams, and compliance officers who require cloud storage with absolute security guarantees and low cognitive friction.

The aesthetic blends **Modern Corporate** efficiency with **Tactile Softness**. The interface emphasizes perceived data safety through disciplined white space, crisp structural lines, and restrained, intentional color accents. Interactions should feel deliberate, robust, and reliable—dispelling ambiguity through clear visual states, ample touch targets, and balanced typographic weight.

## Colors

The palette establishes an immediate sense of institutional trust through deep, saturated blues, resting on crisp, high-clarity background surfaces.

- **Primary (`#2563EB`)**: High-contrast interactive elements, floating action buttons, active navigation markers, and prominent confirmation triggers.
- **Secondary (`#1E3A8A`)**: Deep navy for key identity anchors, dense headers, cryptographic security status badges, and critical system callouts.
- **Tertiary (`#DBEAFE`)**: Soft ice-blue for active row selections, light container fills, category highlight badges, and non-destructive action backgrounds.
- **Neutral Slate (`#64748B`)**: Secondary text, utility icons, metadata labels, and subtle division cues.
- **Base Canvas (`#F8FAFC`)**: Ultra-clean, cool-neutral app canvas ensuring zero eye fatigue during extended auditing sessions.
- **Surface Cards (`#FFFFFF`)**: Pure white elevated modules isolating document details and folder groupings from the canvas.
- **Semantic Accents**:
  - Positive / Verified: `#16A34A`
  - Critical / Destructive: `#DC2626`
  - Outline / Dividers: `#E2E8F0`
  - Primary Typography: `#0F172A`

## Typography

The typography uses Inter across all view hierarchy levels to ensure crisp rendering of file formats, dates, byte counts, and encrypted hash signatures.

- **Headlines & Titles**: Set with tighter negative letter-spacing for structural anchoring at the top of drawers, sheets, and views.
- **Body Text**: Tuned for maximum scanning speed when browsing deeply nested folder paths and long document descriptions.
- **Labels & Monospaced Detail**: High-clarity micro-copy tailored for metadata tags (e.g., `PDF`, `2.4 MB`, `AES-256`, `SHARED`). Numerical sequences should enable tabular figures (`font-variant-numeric: tabular-nums`) to align file metrics vertically.

## Layout & Spacing

Designed primarily for mobile screen dimensions (specifically reference standard 393 × 852 pt viewport), the layout operates on an 8pt-based spatial model supplemented by a 4pt sub-grid for icons and compact chip padding.

- **Canvas Margins**: Set at `1rem` (16px) left and right to maximize screen estate while preserving comfortable thumb touch buffers.
- **Column Structure**: 4 fluid columns on mobile viewport with a `1rem` gutter for grid views of documents, switching to single-column stacking for structured tables and list layouts.
- **Vertical Rhythm**: Headers and segmented controls maintain a `1.5rem` clearance from content sections. Consecutive cards and list rows maintain an 8px to 12px structural separation.
- **Responsive Adaptability**: On tablet viewports (600pt+), margins scale to `1.5rem` (24px) with multi-pane navigation (master list left, document preview right).

## Elevation & Depth

Visual depth is achieved through quiet, soft ambient shadows paired with razor-sharp hairline borders (`#E2E8F0`). This hybrid treatment prevents the UI from feeling flat while preserving the visual precision needed for professional tooling.

- **Level 0 (Canvas)**: Background surface `#F8FAFC`, flat.
- **Level 1 (Cards, List Elements)**: Surface `#FFFFFF`, border 1px solid `#E2E8F0`, shadow `0px 1px 3px rgba(15, 23, 42, 0.05), 0px 4px 6px -2px rgba(15, 23, 42, 0.02)`.
- **Level 2 (Dropdowns, Floating Actions, Bottom Sheet)**: Surface `#FFFFFF`, border 1px solid `#E2E8F0`, shadow `0px 8px 16px -4px rgba(15, 23, 42, 0.08), 0px 2px 4px -1px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modal Dialogs, Security Verification Alerts)**: Surface `#FFFFFF`, border 1px solid `#CBD5E1`, shadow `0px 20px 25px -5px rgba(15, 23, 42, 0.12), 0px 8px 10px -6px rgba(15, 23, 42, 0.04)`.
- **Active / Dragged Elements**: Blue-tinted diffused elevation using `0px 12px 24px -4px rgba(37, 99, 235, 0.16)`.

## Shapes

The design system standardizes on a balanced curve language between 12px (`0.75rem`) and 16px (`1rem`), matching the physical radii of modern mobile displays.

- **Standard Cards & Modals (`rounded-lg`)**: 16px (`1rem`) border-radius for container surfaces, preview panels, and bottom sheets.
- **Buttons & Input Fields (`rounded`)**: 12px (`0.75rem`) for form inputs, primary actions, and menu items to balance compactness with a friendly, touchable profile.
- **Tags, Filter Chips, & Badges**: 8px (`0.5rem`) for compact metadata, or fully circular pill forms for small status dots and quick-counter tags.

## Components

### Buttons
- **Touch Target**: Strict minimum height of `48px` with horizontal padding of `20px`.
- **Primary Button**: Solid `#2563EB` fill, white `#FFFFFF` text (`label-lg`), 12px roundedness. Active state darkens to `#1D4ED8`. Focus outline has a 2px offset in `#93C5FD`.
- **Secondary Button**: Crisp `#FFFFFF` surface with a 1px border of `#E2E8F0`, `#0F172A` text, and subtle hover/pressed tint of `#F1F5F9`.
- **Destructive Button**: Solid `#DC2626` or transparent background with `#DC2626` outline and text for irreversible file deletion warnings.

### Text Inputs & Search Bars
- **Height**: 48px baseline for mobile ergonomics.
- **Resting State**: Background `#FFFFFF`, 1px solid `#E2E8F0`, text `#0F172A`, placeholder `#64748B`.
- **Focused State**: Border shifts to `#2563EB` with a soft 3px `#DBEAFE` focus ring.
- **Search Variant**: Includes a leading Lucide `search` icon (20px, `#64748B`) and trailing clear/filter buttons.

### Chips & Badges
- **Status Badges**: Padding 4px 10px, 8px radius. Verified: `#DCFCE7` surface with `#15803D` text. Pending: `#FEF9C3` surface with `#A16207` text. Encrypted: `#DBEAFE` surface with `#1E3A8A` text.
- **Filter Chips**: Height 36px, horizontal padding 12px, border 1px solid `#E2E8F0`, surface `#FFFFFF`. When selected: surface `#DBEAFE`, border `#2563EB`, text `#1E3A8A`.

### Cards & Document List Items
- **Document List Tile**: White surface, 12px radius, min-height 64px, 1px border `#E2E8F0`. Contains file-type Lucide icon in a tinted 40x40px container, 2-line text block (title + timestamp/size), and trailing action menu button (`more-vertical`).
- **Storage Stat Card**: Elevated Level 1 white card, 16px radius, featuring an integrated progress track: `#E2E8F0` track with `#2563EB` fill, followed by clean tabular data indicators.

### Checkboxes & Radio Elements
- **Size**: 20 × 20px bounding box within a minimum 48 × 48px touch container.
- **Style**: Checkbox has 4px border radius; Radio has full circular radius.
- **Checked State**: Solid `#2563EB` fill displaying a pure white check/dot icon; unselected uses 1.5px outline in `#CBD5E1`.

### Bottom Navigation & App Bar
- **App Bar**: Clean `#FFFFFF` or translucent `#F8FAFC` background with backdrop blur (`blur(12px)`), containing a navigation drawer trigger, folder title in `headline-md`, and security indicator badge.
- **Floating Action Button (FAB)**: 56 × 56px, circular or 16px rounded, positioned at the bottom right. Painted in `#2563EB` with white icon (`plus` or `upload-cloud`), casting a Level 2 shadow.