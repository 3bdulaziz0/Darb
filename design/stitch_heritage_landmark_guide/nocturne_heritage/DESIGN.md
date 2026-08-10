---
name: Nocturne Heritage
colors:
  surface: '#131317'
  surface-dim: '#131317'
  surface-bright: '#39393d'
  surface-container-lowest: '#0e0e12'
  surface-container-low: '#1b1b1f'
  surface-container: '#1f1f23'
  surface-container-high: '#2a292e'
  surface-container-highest: '#353439'
  on-surface: '#e4e1e7'
  on-surface-variant: '#c9c4d8'
  inverse-surface: '#e4e1e7'
  inverse-on-surface: '#303034'
  outline: '#938ea1'
  outline-variant: '#484555'
  surface-tint: '#c9beff'
  primary: '#c9beff'
  on-primary: '#30009b'
  primary-container: '#6c4bf4'
  on-primary-container: '#f1eaff'
  inverse-primary: '#5f3be6'
  secondary: '#dec395'
  on-secondary: '#3e2e0c'
  secondary-container: '#594623'
  on-secondary-container: '#d0b588'
  tertiary: '#ffb68b'
  on-tertiary: '#522300'
  tertiary-container: '#ad5100'
  on-tertiary-container: '#ffe9de'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e6deff'
  primary-fixed-dim: '#c9beff'
  on-primary-fixed: '#1b0063'
  on-primary-fixed-variant: '#4612cf'
  secondary-fixed: '#fcdfaf'
  secondary-fixed-dim: '#dec395'
  on-secondary-fixed: '#271900'
  on-secondary-fixed-variant: '#574421'
  tertiary-fixed: '#ffdbc8'
  tertiary-fixed-dim: '#ffb68b'
  on-tertiary-fixed: '#321300'
  on-tertiary-fixed-variant: '#743400'
  background: '#131317'
  on-background: '#e4e1e7'
  surface-variant: '#353439'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.1em
  caption:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  touch-target-min: 44px
  margin-mobile: 20px
  margin-desktop: 64px
  gutter: 16px
  stack-sm: 8px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style

The design system is rooted in the "Museum Label" aesthetic—a philosophy that prioritizes the object of study over the interface itself. It is designed for a calm, authoritative, and editorial experience tailored for heritage landmark exploration.

The style is a sophisticated blend of **Minimalism** and **Glassmorphism**. It utilizes a camera-first approach where the UI floats over high-fidelity imagery of architecture and history. The emotional response is one of quiet discovery and intellectual respect, avoiding the frenetic energy of social media in favor of a curated, cinematic atmosphere. High-contrast legibility, generous whitespace, and translucent surfaces define the visual language.

## Colors

The palette is optimized for low-light environments and immersive "dark mode" exploration.

- **Primary Violet (#6C4BF4):** Used sparingly for interactive highlights and active states to guide the eye without overwhelming the content.
- **Secondary Sand (#E4C89A):** This "Heritage Gold" acts as the editorial accent, used for scholarly metadata, date ranges, and premium labels.
- **Background & Surface:** The near-black foundation (#0E0E12) ensures that photography and historical artifacts remain the focal point. Surfaces (#1A1A22) provide subtle separation for cards and containers.
- **Functional Colors:** Success and Warning tones are muted to fit the professional, institutional context.

## Typography

This design system employs a strictly geometric and systematic typographic hierarchy. 

- **Manrope** serves as the primary typeface, providing a modern, refined, and balanced feel that ensures legibility for long-form historical descriptions.
- **Space Grotesk** is used for "archival" metadata and labels, its technical and futuristic character providing a sharp contrast to the classical subject matter.
- **Editorial Standards:** Always use generous line heights (minimum 1.5x for body text). Gradients on text and drop shadows are strictly prohibited to maintain the "Museum Label" integrity. All headings should be set in optical sizes appropriate for the screen.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** model with high-impact "safe zones" for camera overlays.

- **Grid:** 4-column for mobile, 12-column for desktop.
- **Rhythm:** An 8px linear scale is used, but touch targets are strictly maintained at a minimum of 44px to ensure accessibility while exploring physical sites.
- **Margins:** Generous side margins (20px mobile) create a "framed" editorial look, mimicking the matting of a gallery photograph.
- **Camera-First Adaptation:** For the AR and camera views, UI elements are anchored to the bottom third of the screen, utilizing a "Sheet" model that can be expanded for deep-dive reading.

## Elevation & Depth

Hierarchy is achieved through **Tonal Layers** and **Glassmorphism** rather than traditional shadows.

- **Backdrop Blurs:** All floating panels and navigation bars must use a 20px Gaussian blur with a 60% opacity fill of the Surface color (#1A1A22). This allows the colors of the heritage site to bleed through while maintaining text legibility.
- **Z-Axis:** 
  - Level 0: Camera Feed / Background Image.
  - Level 1: Translucent overlays and content cards.
  - Level 2: Modals and pop-overs (using a slightly lighter fill or a 1px border stroke of #FFFFFF at 10% opacity).
- **Outlines:** Use 1px soft "ghost borders" in Text Secondary (#A0A0AE) at 20% opacity to define element boundaries on dark backgrounds.

## Shapes

The shape language is defined by large, welcoming radii that contrast with the often sharp, aged lines of historical architecture.

- **Primary Radius:** All main cards and sheets use a **20px** rounded corner.
- **Interactive Elements:** Buttons and input fields follow the `rounded-lg` (16px) standard.
- **Consistency:** Avoid pill-shaped elements for structural components; keep the geometry "Squircle-adjacent" to maintain a modern architectural feel.

## Components

- **Action Buttons:** Large 56px height for primary actions. Background in Primary Violet (#6C4BF4) or Secondary Sand (#E4C89A) for specific heritage highlights. No shadows; use solid fills or translucent glass variants.
- **Information Chips:** Small, 32px height, using the `label-caps` typography. Backgrounds should be a 10% tint of the Primary color or fully transparent with a 1px border.
- **Heritage Cards:** Use a 20px radius. The image occupies the top 60% with a subtle scrim (not a gradient) at the bottom to transition into the Surface color for text.
- **Lists:** Clean, border-bottom only (1px #1A1A22). Large tap targets (64px height) with `body-md` text and `label-caps` metadata.
- **Input Fields:** Minimalist style. Underline or subtle ghost-border. Focus state is a 1px Primary Violet border.
- **Wayfinding Markers:** For the camera-first view, use a circular "pulsing" dot in Primary Violet with a 20px backdrop-blur label attached.