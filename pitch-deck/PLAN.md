# Tulay-Kanban Pitch Deck — Plan

## Folder Structure

```
pitch-deck/
├── PLAN.md          # This file — plan reference
└── index.html       # Single-file interactive slide deck
```

## Step 1 — Create Folder
```bash
mkdir pitch-deck
```

## Step 2 — Write `pitch-deck/PLAN.md`
The plan document (this file).

## Step 3 — Write `pitch-deck/index.html`
Full interactive slide deck — all HTML, CSS, and JS inline.

---

## Tech Stack
- Single `index.html` with inline `<style>` + `<script>`
- Tailwind CSS via CDN (`https://cdn.tailwindcss.com`)
- Custom Tailwind config extending colors
- JetBrains Mono via Google Fonts
- Google Antigravity color palette

## Custom Tailwind Colors
```js
colors: {
  antimatter:    '#0B101E',  // deepest background
  surface:       '#151B2B',  // card/slide surface
  'surface-light': '#1C2540', // elevated surface
  border:        '#1E2740',  // subtle borders
  'blue-accent': '#4285F4',  // Antigravity primary blue
  'cyan-accent': '#22D3EE',  // cyber cyan accent
  'green-accent':'#34A853',  // secure green
}
```

## Slide Structure (5 slides, 100vw × 100vh, overflow-hidden)

### Slide 1 — Title
- Company name: **Tulay-Kanban** (large, bold, with accent glow)
- Tagline: *"Your workflow. Your network. Nobody else's business."*
- Subtitle: "A secure, VPN-only, self-hosted project management tool"
- "Start Presentation" button → navigates to Slide 2
- Decorative accent line

### Slide 2 — The Problem
- Title: "The Vulnerabilities of Public SaaS"
- 3 cards in a row:
  1. **Data Exposure** — Third-party servers exposing client data
  2. **Price Hostage** — Sudden SaaS price hikes with no recourse
  3. **Attack Surface** — Public login pages exposed to bad actors and scrapers
- Each card: icon (inline SVG), title, description, subtle border

### Slide 3 — The Solution & Core Pillars
- Title: "The Invisible Kanban Board"
- Elevator pitch (highlighted quote box)
- 3 pillars:
  1. **Absolute Data Sovereignty** — Your servers, your rules
  2. **VPN-Only Access** — Invisible to the outside world
  3. **Distraction-Free Clarity** — Clean, focused workflow

### Slide 4 — Target Audience
- Title: "Who Needs This"
- 3 market cards:
  1. **Compliance-First** — Legal, Healthcare, Finance firms
  2. **Internal R&D** — Protecting proprietary unreleased tech
  3. **Agencies Under NDA** — Strict confidentiality requirements

### Slide 5 — Vision & CTA
- Title: "The Road Ahead"
- 5-year roadmap timeline (Year 1–5 milestones)
- Call to action: "Ready for the journey."
- Practice pitch note

## Navigation
- **Keyboard**: Left Arrow / Right Arrow keys
- **On-screen**: Prev / Next buttons (fixed bottom center)
- Slide counter between buttons
- Buttons disabled at first/last slide

## Background
- Dark base: `#0B101E`
- CSS-only animated hex/grid pattern (two layers):
  1. Orthogonal grid (blue-accent at 4% opacity)
  2. Diagonal hex-like overlay (cyan-accent at 2% opacity)
- Slow vertical scroll animation
- Vignette radial gradient overlay

## Interactions
- CSS `translateX` transition on `#slides-container` (duration 500ms, ease-in-out)
- Slide index tracking in JS
- Button disabled states
- Keyboard event listener

## Deployment
- Single file → push to GitHub → deploy to Vercel (zero config)
