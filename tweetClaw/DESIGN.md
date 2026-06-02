# Design System — TweetClaw

## Product Context
- **What this is:** A Chrome browser extension popup (320px) that bridges AI agents to social platforms via WebSocket
- **Who it's for:** Developers and AI engineers running local AI agent stacks (OpenClaw, Claude, etc.)
- **Space/industry:** Developer tooling, AI agent infrastructure
- **Project type:** Browser extension popup UI

## Aesthetic Direction
- **Direction:** Industrial-Minimal
- **Decoration level:** Minimal — typography and spacing do all the work, no decorative elements
- **Mood:** A precision instrument. Every pixel serves a function. Dark, focused, technical — feels like a terminal that grew up, not a consumer app that dressed down.

## Typography
- **Display/Hero:** System stack — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  - Rationale: Zero load latency in a popup context. System fonts render crisply on each OS at small sizes.
- **Body:** Same as display (13px base)
- **UI/Labels:** Same as display (10–11px, uppercase for section labels)
- **Data/Tables/Mono:** `'SFMono-Regular', Consolas, 'Liberation Mono', monospace`
  - Used for: IP addresses, port numbers, WebSocket URLs, version strings
- **Code:** Same mono stack
- **Loading:** No external font loading — popup performance is paramount, avoid FOUT
- **Scale:**
  - App title (H1): 16px / 700
  - View title (H2): 14px / 700
  - Section label: 10px / 700 / uppercase / 0.08em tracking
  - Body: 13px / 400
  - Secondary: 11px / 400
  - Mono (URLs, ports): 12px / 400

## Color
- **Approach:** Restrained — one accent color, semantic colors for status only
- **Primary:** `#1d9bf0` — X/Twitter blue, also used for primary action buttons; represents connection/bridge
- **Primary hover:** `#1a8cd8`
- **Primary dim:** `rgba(29,155,240,0.12)` — focus rings, subtle highlights
- **Backgrounds:**
  - Main bg: `#090d14`
  - Surface (cards): `#0f1623`
  - Surface elevated: `#141e2e`
  - Surface hover: `#1a2438`
- **Borders:**
  - Default: `#1e2d42`
  - Strong: `#2a3f5c`
  - Connected accent: `rgba(34,197,94,0.3)`
  - Disconnected accent: `rgba(239,68,68,0.2)`
- **Semantic:**
  - Success: `#22c55e` — connected state, active badge, reconnect button
  - Success dim: `rgba(34,197,94,0.12)` — badge background, status card border
  - Error: `#ef4444` — disconnected state
  - Error dim: `rgba(239,68,68,0.12)`
  - Warning: `#f59e0b` — reserved for future use
  - Pending: `#475569` — disabled platform badge text
- **Text:**
  - Primary: `#e8edf5`
  - Secondary: `#8899aa`
  - Muted: `#4a5568`
- **Dark mode:** This IS the dark mode. No light mode planned.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable (developer tools need breathing room but not consumer-app spaciousness)
- **Scale:**
  - 1: 4px
  - 2: 8px
  - 3: 12px
  - 4: 16px
  - 5: 20px
  - 6: 24px

## Layout
- **Approach:** Grid-disciplined
- **Popup width:** 320px (fixed, browser extension constraint)
- **Content padding:** 16px horizontal
- **Section padding:** 12–14px vertical
- **Max content width:** 320px (constrained by popup)
- **Border radius:**
  - `--radius-sm: 6px` — inputs, small buttons, icon buttons
  - `--radius-md: 10px` — settings cards, status card
  - `--radius-lg: 14px` — platform cards
  - `--radius-full: 9999px` — status dot, badge pill variants

## Motion
- **Approach:** Minimal-functional — only transitions that communicate state change
- **Easing:** `ease` for most; `ease-out` for entrances
- **Duration:**
  - Micro (hover, focus): 150ms
  - Short (view switch): 200ms
  - Status pulse animation: 2.5s ease-in-out infinite
- **Rules:**
  - All interactive elements: `transition: all 0.15s ease`
  - Platform card hover: `transform: translateY(-1px)` + border-color change
  - Connected status dot: CSS pulse animation (box-shadow breathe)
  - View switching: instant (no slide animation — popup UX norms)

## Component Specs

### Status Dot
```css
width: 8px; height: 8px; border-radius: 50%;
/* connected */ background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.12);
/* disconnected */ background: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.12);
```

### Platform Card
```css
padding: 10px 12px;
background: var(--surface);
border: 1px solid var(--border);
border-radius: var(--radius-lg);
/* hover */ background: var(--surface-hover); border-color: var(--border-strong); transform: translateY(-1px);
/* disabled */ opacity: 0.45; pointer-events: none;
```

### Input
```css
background: var(--bg);
border: 1px solid var(--border);
border-radius: var(--radius-sm);
padding: 8px 10px; font-size: 13px;
/* focus */ border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-dim);
```

### Button
```css
border-radius: var(--radius-sm);
font-size: 12–13px; font-weight: 700; padding: 9px;
/* primary */ background: #1d9bf0;
/* success */ background: #22c55e;
/* hover */ filter: brightness(1.1);
```

## Icon Rules
- **All icons must be SVG** — no emoji, no icon font
- **Sizes:** UI/nav 16–18px, platform logos 18–20px, header action buttons 17px
- **Source:** Lucide Icons (MIT) for UI chrome; platform brand SVGs for platform logos
- **Platform icons:**
  - X/Twitter: official X logo SVG (black/white path)
  - Xiaohongshu: brand red `#ff2442` with 小 character
  - Reddit: `#ff4500` Snoo SVG
  - Discord: `#5865f2` Wumpus/blurple SVG

## Information Architecture

Three views:

1. **Main View** — Always shows: global bridge status + platform list + footer
2. **Settings View** (new) — Accessed via ⚙ gear in header: WS/REST connection config + instance name
3. **Platform Detail View** — Accessed via platform card: platform capabilities + platform-specific info

> Key principle: connection settings are GLOBAL infrastructure, not owned by any single platform.
> The gear icon in the header is the single entry point for all bridge configuration.

## Anti-Patterns (never do these)
- No emoji as icons anywhere in the UI
- No `style=""` inline styles — all styling via CSS classes and custom properties
- No external font loading
- No light mode implementation (this is a dev tool, dark only)
- No decorative gradients or blobs as background elements
- No AI purple/pink gradient accents

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-02 | Industrial-Minimal aesthetic | Dev tool for technical users; every pixel functional |
| 2026-06-02 | System font stack | Zero FOUT, crisp at 11–13px, no network request in popup |
| 2026-06-02 | Gear icon → global settings (not X card → settings) | WS connection is shared infrastructure; belongs at app level |
| 2026-06-02 | XHS status changed to Active | Code already implements XHS; UI was misleading users |
| 2026-06-02 | Status card on main view (always visible) | Connection state is the #1 thing users need to see immediately |
| 2026-06-02 | Remove emoji icons | Render inconsistency across OS; SVG is reliable and professional |
