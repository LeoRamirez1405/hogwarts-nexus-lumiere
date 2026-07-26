---
name: Lumiére Design System
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#42474e'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#73777f'
  outline-variant: '#c2c7cf'
  surface-tint: '#3b6188'
  primary: '#0e3b60'
  on-primary: '#ffffff'
  primary-container: '#2b5278'
  on-primary-container: '#a0c5f1'
  inverse-primary: '#a4caf6'
  secondary: '#775a19'
  on-secondary: '#ffffff'
  secondary-container: '#fed488'
  on-secondary-container: '#785a1a'
  tertiary: '#36393c'
  on-tertiary: '#ffffff'
  tertiary-container: '#4d5053'
  on-tertiary-container: '#c0c2c6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d0e4ff'
  primary-fixed-dim: '#a4caf6'
  on-primary-fixed: '#001d35'
  on-primary-fixed-variant: '#21496f'
  secondary-fixed: '#ffdea5'
  secondary-fixed-dim: '#e9c176'
  on-secondary-fixed: '#261900'
  on-secondary-fixed-variant: '#5d4201'
  tertiary-fixed: '#e0e2e6'
  tertiary-fixed-dim: '#c4c7ca'
  on-tertiary-fixed: '#191c1f'
  on-tertiary-fixed-variant: '#44474a'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-lg:
    fontFamily: EB Garamond
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: EB Garamond
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: EB Garamond
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 36px
  title-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
The design system establishes a "Magical Modernism" aesthetic—a sophisticated blend of Wizarding World heritage and contemporary digital elegance. It is designed for a dual-purpose platform: a social hub for magical connections and a refined economic engine. 

The style moves away from heavy, weathered textures in favor of **Glassmorphism** and **Minimalism**. It utilizes high-transparency layers, subtle light refraction, and precise typography to evoke the feeling of "Lumos" (light). The interface should feel ethereal yet structured, prioritizing clarity and white space while using metallic accents (Silver and Gold) to denote value and prestige. 

The emotional response is one of wonder tempered by professional reliability, catering to an audience that values both magical whimsy and financial precision.

## Colors
The color strategy employs a "Zonal Palette" approach to distinguish the platform's various magical sectors while maintaining a unified underlying logic.

- **Primary & Secondary:** Navy Blue (#2B5278) represents institutional wisdom, while Gold (#C5A059) signifies economic value.
- **Surface Strategy:** Most zones utilize a high-key White background to ensure modern readability.
- **Zone Specifics:**
    - **The Quibbler:** Uses Pale Yellow accents to mimic fresh newsprint without the aged fatigue.
    - **Borgin and Burkes:** The only zone to invert the color mode to **Dark**, using deep charcoals and "Antique Gold" to evoke mystery and the Dark Arts.
    - **Pet Sanctuary:** Employs a soft "Nature Green" and "Sky Blue" to create a nurturing, outdoor atmosphere.

## Typography
This design system uses a curated typographic hierarchy to balance heritage and utility.

- **Headlines (EB Garamond):** Used for all major page titles and section headers. It brings an authoritative, literary, and timeless feel to the interface.
- **UI & Body (Hanken Grotesk):** A sharp, contemporary sans-serif used for all functional text, ensuring maximum legibility during social interactions and economic transactions.
- **System Labels (JetBrains Mono):** Used for technical data, price points in Zerines (💎), and metadata. The monospaced nature suggests the precision of ancient runes and modern accounting.

## Layout & Spacing
The layout follows a **Fluid Grid** logic with generous margins to reinforce the premium, "uncluttered" magical feel.

- **Rhythm:** An 8px base unit governs all padding and margins.
- **Desktop:** 12-column grid with a 1280px max-width container. 
- **Mobile:** Single column with 16px side margins. 
- **Component Spacing:** Use wider internal padding (24px+) for "Parchment" and "Crystal" containers to allow the design to breathe.

## Elevation & Depth
Hierarchy is established through **Tonal Layering** and **Refractive Blurs**.

- **Level 0 (Base):** Flat white or deep black (Borgin).
- **Level 1 (Cards):** Subsurface scattering effect. A 1px solid border (Silver or Gold) with a very soft, 20px blur ambient shadow.
- **Level 2 (Modals/Popovers):** Glassmorphism style. `backdrop-filter: blur(12px)` with a 10% white tint.
- **The Treasure Chamber:** Elements here should use high-gloss reflections and inner glows to mimic the facets of a gemstone.

## Shapes
The shape language is primarily **Rounded (0.5rem)** to maintain a friendly, modern social feel. 

- **Standard Elements:** 8px (0.5rem) corner radius.
- **Buttons & Chips:** 100px (Pill-shaped) to represent the flow of magic.
- **Specialty Shapes:** The Treasure Chamber uses 0px (Sharp) or "Gem-cut" clipped corners for high-value items to signify "cut" stones.

## Components

### Buttons
- **General:** Pill-shaped, semi-transparent background with a 1px border.
- **Crystal (Treasure Chamber):** High-contrast gradient (Deep Blue to Gold), high-gloss overlay, and a subtle "inner-sparkle" texture.
- **Borgin & Burkes:** Sharp corners, black background, thin gold border, hover effect increases border glow.

### Cards & Containers
- **The Quibbler:** Uses a "Modern Parchment" style—off-white background, subtle vertical texture, and ragged-edge borders on the top and bottom only.
- **Social Profile:** Minimalist white cards with high-contrast profile photos and thin gold separators.

### Economy & Data
- **Zerines (💎):** Always accompanied by the diamond icon. Values are rendered in `label-sm` (JetBrains Mono).
- **Pet Status Bars:** Segmented progress bars. "Feeding" uses a soft green fill; "Playing" uses a light blue. Background of the bar is a 10% opacity version of the fill color.

### Iconography
- **Icons:** Use a thin-stroke (1.5px) weight. 
- **Interaction:** Icons should subtly glow on hover to indicate magical activation.