# DataTalks Learning design system

A welcoming, independent home for the DataTalks.Club course collection. The first local reading path is ML Zoomcamp; branding and navigation belong to the whole collection and have no cohort-year dependency.

## Color

The main surface is white `#ffffff`, with ink `#28283e`, secondary text `#626277`, pale lavender panels around `#ededfc` and deep violet links/buttons (`#5550a2` / `#5951a6`). These are inspired by the user's DataTalks.Club screenshot; they are not claimed to be official brand tokens.

| Course tone | Accent | Light surface | Use |
| --- | --- | --- | --- |
| Lavender | `#b9b6eb` | `#ededfc` | Machine Learning |
| Blue | `#aab6e7` | `#f0f1fd` | Data Engineering |
| Lilac | `#beb5e6` | `#efedfc` | MLOps |
| Soft gold detail | `#ded1a4` | `#f5f3fd` | LLM Engineering |

White remains the page background. Broad course panels, the learning note and hero artwork use lavender rather than warm cream or orange. Deep violet provides readable interactive labels; decorative tints do not carry body text. Dark mode uses neutral violet-charcoal surfaces and lighter violet accents.

The site logo is an open book on a pale-lavender square. Hero geometry and footer separators use an orbit/diamond motif, without a radial star emblem. The existing hero arrangement, type scale, navigation and course structure are retained.

## Typography and layout

- Display and headings: locally served Outfit Variable, weights 450–550.
- Body and interface: locally served DM Sans Variable, with PingFang SC/Microsoft YaHei fallbacks.
- Code: the VitePress monospace stack.
- Desktop home content width: approximately 1120px; two-column course collection.
- Mobile: one course per row, a compact hero illustration, wrapping controls and no fixed-width text.
- Course reading: retain the familiar sidebar, search, outline and up-to-800px prose column.
- Radius hierarchy: 4px tags, 6–7px controls, 9–12px panels; circular shapes are decorative artwork.

## Motion and accessibility

The hero's paper cards gently drift. Course cards and links move slightly on hover; category filtering is immediate. Motion respects `prefers-reduced-motion`. Keyboard focus uses a visible blue outline. Course filters expose `aria-pressed` and course availability is written in text as well as encoded by color.

## Content rules

Counts come from the imported manifest. Official external resources are labeled as external. No invented import status, lesson count or learner metric. Source attribution remains visible. The previous ML completion storage key is internal compatibility data, not the site's identity.

## Implementation

Color tokens and responsive/motion rules live in `docs/.vitepress/theme/custom.css`. Per-course accents and site identity live in `src/config/courses.ts`. The frontend and tools use strict TypeScript. New visual work should build on these tokens and keep reading pages calm while the course catalog carries the playful elements.

## Learning progress additions

Keep the existing hero, catalog and reading layout. Progress uses the same white/lavender surfaces and violet accents: a compact resume panel on the home page, a course summary, and native disclosure lists under each module. Native progress elements show both a numeric lesson count and a percentage. Only real local lessons are counted; guides, projects and externally hosted courses do not claim completion tracking.

Completion is explicit and reversible. Opening a lesson records the last location without marking it complete. The lesson footer offers a single completion/continue action. Progress is local to the browser; course-level export/import and visible storage failure messages support recovery without adding an account flow.
