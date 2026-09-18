# TakkieAI Design System

## Overview

TakkieAI is a restrained desktop productivity tool. The Windows Notetaker redesign follows Fahim's six Flow reference screenshots. Light is the default; explicit dark and system themes remain available. A small black floating HUD communicates capture without taking focus. The Windows-specific tokens in `windows/src/renderer/flow.css` override the earlier Google direction below.

## Windows Notetaker direction (September 2026)

- Warm neutral exterior around an inset white work surface; 208px sidebar, approximately 40px content padding, quiet black primary actions and teal activity graphics.
- 15px base text, 24px screen headings, serif only in editorial headings and settings titles. Consistent line icons with no decorative icon tiles.
- Notetaker is the entry screen: upcoming Google Calendar meetings above a dated list of local notes. Detail has Summary, Transcript and Own notes; capture and AI states remain separate.
- Settings use a native dialog with its own navigation rail and focus handling. Empty, loading, disconnected and failed states offer real recovery actions.
- Active compact HUD is approximately 104×30px, white waveform on black, pause/cancel and finish. Hover reveals more information. An optional larger variant improves accessibility.
- Narrow windows reflow the navigation and actions, preserving keyboard access and scrollable content. No fake paid plans, usage limits or population percentiles.

The remainder documents the earlier shared/macOS design and remains applicable where Windows does not override it.

## Color

Use semantic tokens in OKLCH, with hex fallbacks for Electron. Primary actions and active selection use Google blue (`#0B57D0` light, `#A8C7FA` dark). Surfaces use `#FFFFFF`, `#F0F4F9`, and `#F8FAFD` in light mode and `#1E1F20`, `#28292A`, and `#131314` in dark mode. Body ink is `#1F1F1F` light and `#E3E3E3` dark. Error is `#B3261E`; success is `#146C2E`. The Google four-color set is reserved for waveform processing feedback only.

Every foreground/background pair must meet WCAG 2.2 AA. Focus indication must not rely on color alone.

## Typography

Use Google Sans Flex where bundled, falling back to `Segoe UI Variable`, `Segoe UI`, and `system-ui`. Use one family throughout the product UI. Use Google Sans Code only for API keys, model identifiers, and technical paths. Keep the scale compact: 12px labels, 14px body, 16px titles, 24px page headings, and 32px onboarding display text.

## Layout

The primary window uses a 208px navigation rail and a flexible content pane with a minimum desktop size of 900x620. Content follows a 4px spacing foundation with 8, 12, 16, 24, 32, and 40px steps. Dense settings use aligned labels and controls; history uses a readable single-column timeline. At narrow widths the navigation becomes a top tab strip and content remains vertically scrollable.

## Components

Buttons, fields, toggles, tabs, list rows, banners, dialogs, and toasts share one interaction vocabulary with default, hover, focus-visible, active, disabled, loading, success, and error states. Corners are 8px for controls, 12px for panels, 16px for major containers, and full-pill only for pill buttons and the floating HUD.

The HUD has explicit idle, listening, locked, processing, success, clipboard fallback, offline, and error states. It never takes keyboard focus while dictating. Motion communicates state in 150–250ms and is removed or reduced when the operating system requests reduced motion.

## Iconography and Sound

Use simple line icons with consistent stroke weight. The TakkieAI mark is a pill containing waveform bars; do not use the Gemini spark. Earcons are short, quiet, optional, and aligned with recording start, stop, lock, success, cancel, and error transitions.

## Content

Copy is short, direct, and reassuring. Name what happened and what the user can do next. Error messages must say whether audio was saved. Avoid hype, anthropomorphic AI language, and technical details unless the user opens Advanced settings.
