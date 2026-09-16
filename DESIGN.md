# Jot Design System

## Overview

Jot is a restrained desktop productivity tool. On Windows it uses a light, cool-neutral work surface by default, follows the system theme, and uses a compact floating HUD for state feedback. Familiar controls and high information clarity take priority over visual novelty.

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

Use simple line icons with consistent stroke weight. The Jot mark is a pill containing waveform bars; do not use the Gemini spark. Earcons are short, quiet, optional, and aligned with recording start, stop, lock, success, cancel, and error transitions.

## Content

Copy is short, direct, and reassuring. Name what happened and what the user can do next. Error messages must say whether audio was saved. Avoid hype, anthropomorphic AI language, and technical details unless the user opens Advanced settings.
