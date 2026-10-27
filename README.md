# DataTalks Learning

An independent learning hub for the [DataTalks.Club](https://datatalks.club/) course community. The site is organized around learning paths rather than a particular year or one course. Machine Learning Zoomcamp is currently available for local reading; Data Engineering, MLOps, and LLM Zoomcamp link to their official resources.

## Course configuration and TypeScript

Application code, content importers, validators and tests are written in TypeScript with strict checking. Vue components use `<script setup lang="ts">`. `tsx` runs Node scripts, and `vue-tsc` checks the scripts, shared types, VitePress configuration and Vue templates.

- `src/config/courses.ts`: site identity and the typed course registry. Each course has its own identity, accent color, source repository and availability (`local` or `external`).
- `src/types/course.ts`: shared types for manifests, modules, pages, metadata, resources, diagnostics and navigation.
- `docs/.vitepress/data/catalog.data.ts`: loads actual module/lesson counts from each local manifest; external courses have no invented local counts.
- `docs/.vitepress/theme/components/`: the course catalog, course overview and small vector illustrations.
- `scripts/`: TypeScript course synchronization, rendering, validation and regression tests.
- `DESIGN.md`: colors, typography, responsive layout and motion conventions.

To add a course to the catalog, add a typed registry entry. An external entry opens its official repository. A local entry also needs its own importer, manifest, overview/start routes and a distinct content prefix; switching the registry alone does not import course content. The current importer remains dedicated to the official ML repository's structure. The existing `/course/...` URLs and browser completion key are retained for compatibility.

## Requirements

- Node.js 20.11 or newer
- pnpm 10; `package.json` pins pnpm 10.23.0
- Git and access to github.com for course synchronization

## Run locally

```bash
pnpm install --frozen-lockfile
pnpm sync:course
pnpm dev
```

Open the URL VitePress prints, normally `http://localhost:5173/`. The first `pnpm dev` or `pnpm build` also synchronizes if a current import and its source snapshot are absent. Once synced, development, validation and builds can run offline; external videos and remote resources still need internet access.

```bash
pnpm typecheck
pnpm test
pnpm validate:course
pnpm build
pnpm validate:build
pnpm preview
```

`pnpm build` runs strict TypeScript checking and source/content validation before the VitePress production build. `pnpm validate:build` additionally examines every generated course HTML page, internal route, anchor and local image. Run it after a successful build. Preview normally uses `http://localhost:4173/`.

`patches/vitepress@1.6.4.patch` guards a default-theme outline callback that can run after its elements are unmounted during rapid navigation. pnpm applies it automatically; the patch hash is recorded in the lockfile. Re-evaluate the patch when upgrading VitePress. Restart `pnpm preview` after rebuilding so its static file inventory reflects the new asset hashes.

## Imported scope

The importer reads the official root README, numbered module directories, module READMEs and `module.yaml` where present. It imports all existing top-level chapter Markdown plus supplementary workshop/PyTorch guides, including nested guides. The current source has modules 01–06, 08–11 and project instructions. Module 11 (KServe) exists as optional older material outside the root syllabus. No Module 7 or numbered chapters are invented; the syllabus's midterm and capstone entries point to the same project guidelines and are not duplicated.

Module README order is retained. Actual chapters found only in `module.yaml` or the directory are included and diagnosed. Workshops and project guides are classified separately from numbered lessons. Image provenance/audit logs and code plans remain auxiliary upstream resources, not lessons. Official notices about outdated material remain intact.

Reading, search, video embedding and official previous/next navigation are retained. Learning progress remains browser-local; accounts, cloud sync, notebook execution and automatic exercise grading are not implemented.

## Learning progress

- Mark a lesson complete, undo a completion, or use **Complete & continue** at the end of a lesson to mark it and open the next unfinished lesson.
- The home page offers **Continue learning** for the most recently visited local course. The course overview shows the total and per-module progress, the last opened lesson, and expandable lesson lists with completion status.
- Opening a lesson records the last reading location without marking it complete. Resume returns to that unfinished lesson; when it is complete, it searches forward and wraps around to earlier unfinished lessons. A fully completed course offers a review entry.
- Progress counts actual numbered lessons, including the optional older module; extra guides and project instructions do not inflate the total. External course links do not claim tracked progress.
- Existing `ml-zoomcamp-reader:completed:v1` records are automatically read when the new `datatalks-learning:progress:v1` store is absent. The old data is retained. New data separates progress by course ID and uses stable lesson routes.
- Same-origin browser tabs synchronize updates. Storage failures display a warning and keep changes in memory for the session instead of pretending they were saved. Corrupt saved data is not overwritten automatically.
- On the course overview, **Export progress** downloads a JSON backup. **Import backup** merges completion marks, keeps existing completions and reports unavailable lesson/course entries it skips. Invalid or unsupported backups do not change progress. An explicit valid import can recover an unreadable progress store.

There is no login or automatic cross-device sync. Storage is separate for each browser profile and site origin; export/import a backup when changing browsers, devices or domains. Video timestamps and exercise results are not tracked, and opening or watching a video does not automatically complete a lesson.

## Reproducible synchronization

```bash
pnpm sync:course                     # official main branch
pnpm sync:course --ref <branch-or-tag>
pnpm sync:course --source /path/to/clean/official-checkout
```

`--source` uses the checkout's HEAD without fetching or resetting it; for sparse checkouts it may materialize the selected files. This is useful for testing a pinned commit. `--ref` selects the branch/tag when cloning; `sourceCommit` records the actual imported revision.

The importer fetches Markdown and referenced image assets instead of downloading large datasets or model weights. A full import is staged and validated before replacing the existing generated course. Fetch or validation failures leave the last successful course in place; publication failures roll back the replaced trees. Do not run simultaneous syncs.

Generated files:

- `docs/course/`: official Markdown bodies with source metadata, official code-resource links and resolved navigation.
- `docs/public/course-assets/`: only assets referenced by imported pages, preserving repository paths.
- `docs/course-manifest.json`: revision, modules, page classifications, original video/navigation metadata, resolved links and hashes.
- `.cache/course/source/` and `.cache/course/snapshot.json`: independent original Markdown/index snapshot and repository inventory for offline revalidation.
- `reports/course-quality.json`: the latest machine-readable check results and all diagnostics.

Course content, assets and snapshots are ignored by Git. Commit `pnpm-lock.yaml` when dependencies change. Do not edit generated course Markdown; update the importer or upstream materials and resync.

## Following upstream course updates

The source of truth is the official repository, not a manually maintained copy of its lessons in this repository. The importer clones the repository once per synchronization using a shallow, blob-filtered checkout. It materializes only Markdown/index files and referenced image assets; it does not copy the full repository once per lesson. Notebooks, datasets, model weights and auxiliary code remain linked upstream. The temporary checkout is removed when synchronization finishes.

The normal flow is **official repository → build-time import → validation → static output → hosting**. Generated Markdown, the manifest, images and the independent validation snapshot are ignored by Git. Only `docs/.vitepress/dist` is published. Neither `node_modules`, `.cache` nor the source checkout belongs in the published directory.

This keeps runtime independent of GitHub's availability and gives the renderer, local search, links, videos and navigation a consistent source revision. Fetching Markdown directly from GitHub in each visitor's browser is possible but would require a separate runtime renderer, URL rewriting and failure handling; it does not provide the already-built local search index. REST API-based implementations must also respect [GitHub's API limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api); these limits should not be confused with raw-file download limits. We use build-time imports rather than visitor-time fetching.

Local files consume disk space, not an equivalent amount of permanently resident application memory. On 2026-10-27, actual file sizes were approximately 0.9 MB for 137 generated Markdown pages, 30.3 MB for referenced images and 49.5 MB for the whole static output (decimal MB, before HTTP compression). Build processes and the visitor's current page still use memory. A static host/CDN serves files without running a persistent application process for this project.

To fetch the current official `main` branch, run all regression checks and rebuild the site:

```bash
pnpm update:course
```

This expands to `pnpm sync:course && pnpm test && pnpm build && pnpm validate:build`. A failed command stops the chain; it does not publish anything. Synchronization validates staged imports before replacement, preserves the last successful import on fetch/source-validation failure and records `sourceCommit` / `generatedAt` in `docs/course-manifest.json`. Each page retains an official source link pinned to that revision. After the command succeeds, deploy the new output directory to your selected static host. Restart an existing development server after synchronization so its generated sidebar configuration reloads too.

**`pnpm build` alone does not check for upstream changes when a valid local import is already present.** `ensure-course.ts` is a bootstrap check, not an update watcher. Deployment build caches may retain an older import; use `pnpm update:course` as the build command when the deployment must explicitly follow the latest upstream source.

For an existing official branch/tag, `pnpm sync:course --ref <branch-or-tag>` imports that ref. To reproduce a particular commit exactly, prepare a clean official checkout at that commit and pass `--source /path/to/checkout`, then run the normal build and built-output validation. `--ref` is passed to `git clone --branch`; an arbitrary commit SHA is not accepted as a branch name. Generated content should never be hand-edited because the next synchronization replaces it.

Upstream changes do not automatically trigger this repository's hosting build. For automation, a [scheduled GitHub Actions workflow](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) can compare the upstream commit and run this update chain before publishing with the chosen platform's deployment step. No scheduled workflow, deployment hook or automatic publishing is configured yet. Choose the host before wiring that final step; a static deployment stays on its current content until a new build is published.

Progress is keyed by course ID and lesson route. Updating text at the same route preserves completion marks. Renamed/deleted upstream chapters keep their old stored records but are excluded from current totals; no automatic route migration is inferred.

## Working files and cleanup

Keep source code, tests, the lockfile, `patches/`, course configuration and documentation. `node_modules` is needed for local development; `.cache/course` supplies the original snapshot required for offline source-integrity checks. The imported course files and images are needed for rendering. All are excluded from source control where appropriate.

Browser screenshots, temporary test backups, one-off phase reports and the dependency patch edit directory are not required for delivery. `.vitepress/cache` and `.vitepress/.temp` can be regenerated while the development server is stopped. `reports/course-quality.json` is a generated diagnostic report and is ignored by Git. Keep `.vitepress/dist` when preparing a static upload; builds regenerate it.

## Markdown, links and provenance

Official Markdown bodies remain unchanged. A shared Markdown renderer plugin resolves inline links, reference links, HTML `href`/`src` attributes, relative/cross-module paths, directory READMEs, encoded filenames, queries and anchors. Fenced/inline code examples are not rewritten. VitePress renders tables and syntax-highlighted code; MathJax handles formulas, including inline `$$...$$` in list paragraphs. Document placeholders such as `<ENTER>` render as text instead of Vue elements.

Imported pages link locally; Notebook, code, data, model and non-imported resource links point to the exact official Git commit. Front-matter `code` resources remain accessible as official resource links. Metadata supplies previous/next destinations, including cross-module paths; missing metadata uses the module's actual chapter order, with invalid metadata diagnosed. Video URLs come from front matter or an existing YouTube link in older Markdown; absent videos are reported as absent, never fabricated.

Every page records its official path, source URL, commit and source hash. The existing source link on lesson pages points to that exact file; module and guide pages also include an official-source link.

Reviewed upstream path corrections live in `scripts/upstream-link-fixes.json`, with their evidence/reasons. They only apply when the original target is absent and the replacement exists. The unambiguous `.dm` → `.md` index typo is also diagnosed. Unknown missing resources are reported, not silently dropped. Unmatched local anchors retain an explicit upstream link with a diagnostic, without claiming the upstream anchor works. Required missing images fail validation. Tutorial URLs such as `http://localhost:9696/docs` are individually diagnosed and excluded from VitePress's website-route checks; internal site dead-link checking remains enabled.

## Quality checks and limits

`pnpm validate:course` independently rebuilds the expected catalog from the original source snapshot, then checks module/chapter coverage, duplicates, stale generated pages, source/body preservation, content/asset hashes, link conversion, local paths, anchors, video URL structure, navigation, Vue-template compilation, formulas, tables, code blocks and unresolved reference-style Markdown. It exits nonzero on errors and writes all findings to `reports/course-quality.json`.

`pnpm test` includes regression fixtures and deliberately missing images/pages, duplicate catalog entries and invalid video metadata, to verify that the gate detects failures.

These are offline structural/rendering checks. Remote HTTP availability, YouTube playback, external image downloads and auxiliary Notebook/code/data execution are not tested. Some official chapters contain community-note placeholders or older deployment instructions; those are retained as official content rather than rewritten. Course platform, homework submission and grading remain on the official DataTalks.Club platform. Course materials remain attributed to their authors; this project is independent and not affiliated with DataTalks.Club.

## Visual design

The site uses a white background with broad pale-lavender surfaces inspired by the DataTalks.Club reference, deep violet interactive accents and subtle blue/yellow details. Outfit and DM Sans variable fonts are served locally from the build, with system fallbacks for scripts they do not cover. Light/dark themes, keyboard focus indicators and a reduced-motion preference are supported. The course catalog filters between all paths, local reading and official external resources.

Branding and top-level links are not tied to a cohort year. Dates and version notes inside official source materials are preserved as course content. This interface is independent of DataTalks.Club; its official registration, grading and community tools remain linked externally.

## YouTube player

Lessons use the standard `www.youtube.com/embed/` player with native controls, keyboard shortcuts, fullscreen and inline mobile playback enabled. Playback is not started automatically. Subtitles, speed and quality settings use YouTube's own controls and depend on the video/device. There is no custom control bar or player-mode selector. The player keeps at least a 200px-high viewport on small screens. A standalone **Watch on YouTube** link is always available. The player configuration lives in `src/lib/youtube.ts`.

The site does not load browser extensions or force a particular version of YouTube's control-bar design. The direct YouTube link is available when the full watch page is preferred.

References: [YouTube embed parameters](https://developers.google.com/youtube/player_parameters), [Chrome content-script URL matching and frames](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#frames).

## Static deployment

This is a static VitePress application. Node.js, filesystem access and Git are only needed during content import and building. The deployed output is HTML, CSS, JavaScript, search indexes and assets. No Node server, API function, database or Worker is required at runtime. Lesson completion remains in browser localStorage, separately for each origin.

| Setting | Value |
| --- | --- |
| Project root | Repository root |
| Framework | Static site / VitePress |
| Install | `pnpm install --frozen-lockfile` (pnpm 10.23.0) |
| Build existing imported revision | `pnpm build && pnpm validate:build` |
| Build with explicit upstream refresh | `pnpm update:course` |
| Published directory | `docs/.vitepress/dist` |
| Node.js | A supported Node LTS, at least 20.11 |

Set the pnpm version to the version pinned in `package.json` if the hosting platform's default differs. On a clean cloud checkout, `pnpm build` automatically fetches the official ML course because generated content and its snapshot are ignored by Git. The build environment needs Git and access to github.com and the package registry. Do not replace the build command with bare `vitepress build`: it would skip source preparation and quality checks.

The current site assumes a domain-root deployment (`/`) and uses `cleanUrls`. Confirm that the chosen host serves extensionless HTML routes. GitHub Pages project sites under `/repository-name/` need a configured `base` plus an audit of root-absolute links, and may need different URL handling; they are not verified by the current root-path build. Cloudflare Pages and Netlify are also options for publishing the static directory. No hosting-specific deployment has been configured.

Keep the generated `404.html`; do not add a catch-all rewrite of every request to `index.html`. Only files under `/assets/` have content-hashed filenames; do not apply immutable caching to all pages or course assets.

To verify locally, run `pnpm build && pnpm validate:build`, then `pnpm preview`. Uploading the resulting directory or connecting a Git repository to either host is a separate deployment action; no deployment has been performed by these configuration changes.

Official references: [VitePress deployment guide](https://vitepress.dev/guide/deploy), [Cloudflare Pages VitePress guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vitepress-site/).
