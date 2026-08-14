# Design System: Arturnito Neo-Retro Dev Deck

This document defines the design tokens and component guidelines for the Arturnito Web App, specifically formatted for Stitch. It merges an 8-bit/pixel-art aesthetic with a strict R2-D2 color palette, generating a "Neo-Retro Dev Deck" feel—like an annotated 90s engineering notebook for modern AI builders.

## 1. Core Visual Identity
- **Theme:** Neo-Retro Dev Deck / 8-bit Infographic Editorial
- **Mood:** Confident, playful, declarative, builder-centric.
- **Rules:** No gradients, no soft shadows, no corporate fluff. Embrace controlled imperfection, thick borders, and flat hard-edged shadows.

## 2. Color Palette
Strict adherence to the R2-D2 mechanical palette, heavily contrasted with thick black outlines.

### Base Colors
- `color-background`: `#FDFBF7` (Off-white/Cream - used for the grid paper base)
- `color-black`: `#000000` (Strictly for text, borders, and hard shadows)
- `color-white`: `#FFFFFF` (Base for cards and high-contrast blocks)

### R2-D2 Theme Colors
- `color-primary` (R2 Cobalt): `#005596` (Used for primary actions, brain/agent concepts)
- `color-secondary` (Sensor Red): `#E11927` (Used for alerts, highlights, execution layers)
- `color-tertiary` (Mech Silver): `#A8A8A8` (Used for secondary blocks, disabled states, structural elements)

## 3. Typography
High contrast, bold, and geometric. Language is declarative and mixed (Spanish main text + English sub-labels).

- **Font Family Primary (Headings):** `'Archivo Black', sans-serif`
- **Font Family Secondary (Body & Labels):** `'Space Grotesk', sans-serif`
- **Font Family Mono/Pixel (Accents):** `'VT323', monospace` or `'Press Start 2P'`

### Type Scale
- `text-h1`: 72px, Archivo Black, uppercase, tight line-height (0.9)
- `text-h2`: 48px, Archivo Black, uppercase, tight line-height (1.0)
- `text-h3`: 24px, Archivo Black, uppercase
- `text-body-large`: 18px, Space Grotesk, regular, line-height 1.4
- `text-body-base`: 16px, Space Grotesk, regular
- `text-sublabel`: 12px, VT323 or Space Grotesk Bold, uppercase, tracking 2px (e.g., `BEEP BOOP // SYSTEM ONLINE`)

## 4. Spacing & Layout
Modular, stacked blocks that feel like they are assembled on a canvas.

- `space-xs`: 4px
- `space-sm`: 8px
- `space-md`: 16px
- `space-lg`: 24px
- `space-xl`: 48px
- `space-xxl`: 80px

### Global Canvas
- **Background Pattern:** A subtle square grid (engineering notebook feel). 
- **Grid CSS:** `linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)` with `background-size: 40px 40px`.

## 5. Borders & Shadows (The "Neo-Brutalist" Pixel Feel)
- `border-width-thick`: `4px`
- `border-color-default`: `color-black`
- `border-radius-none`: `0px` (Strictly sharp corners, no rounding)
- `shadow-hard-offset`: `8px 8px 0px #000000` (Solid black drop shadow, NO blur)

## 6. Component Specs

### Cards (`.box-block`)
Used for steps, evolution layers, and system architecture.
- **Background:** `color-white` (or filled with primary/secondary colors)
- **Border:** `border-width-thick solid color-black`
- **Shadow:** `shadow-hard-offset`
- **Padding:** `space-lg`
- *Note: Allow slight negative margins or overlaps (e.g., `transform: rotate(-1deg)`) for a collage-like assembly.*

### Buttons (`.btn-pixel`)
- **Background:** `color-primary`
- **Text:** `color-white`, `text-h3`
- **Border:** `border-width-thick solid color-black`
- **Shadow:** `4px 4px 0px #000000`
- **Hover State:** Translate X/Y by 2px, reduce shadow to `2px 2px 0px #000000` (physical button press effect).

### Section Headers / Dividers
- Thick horizontal bars traversing the screen width.
- Border: `border-width-thick solid color-black`
- Background: `color-secondary`
- Height: `space-xl`

## 7. Iconography & Assets
- **Style:** 8-bit or 16-bit inspired pixel art. Flat colors, black outlines. Low-resolution look.
- **Key Icons:** Robot/R2D2 agent, Gears, Code brackets, WhatsApp bubble (pixelated), Calendar grid.
- **Decorative:** Pixel sparks (small solid squares with offset hard shadows), Chevrons `< >`.

## 8. Tone of Text (Copywriting Guidelines)
- Short. Declarative.
- *Good:* "TURNOS AUTOMATIZADOS." / "BEEP BOOP. AGENDADO."
- *Bad:* "Empoderando a tu negocio con soluciones vanguardistas de IA."
