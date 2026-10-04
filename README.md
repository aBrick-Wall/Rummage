# Rummage

**Rummage** is a desktop media app by **Dumpsterlight Digital** (Raccoonware). It browses and plays
media you own or have permission to access: files on this PC, on a NAS, and (in the future) free,
authorized online sources and third-party provider plugins.

Rummage is not a downloader. It adds no piracy features, no DRM circumvention, and no downloading
from services that prohibit it.

> Status: **Phase 1** - a local-library vertical slice. See [Deferred](#deferred-on-purpose).

## Product language

| Concept                   | UI wording                                      |
| ------------------------- | ----------------------------------------------- |
| Search                    | **Rummage** ("Rummage for something to watch…") |
| Personal library          | **Your Stash**                                  |
| Connect a folder / NAS    | **Add Your Stash**                              |
| Free online media (later) | **Free Finds**                                  |
| Saved for later (later)   | **Watch Pile**                                  |

## Getting started

Requires Node.js 22.13+ (Electron 39 bundles Node 22.20, which provides `node:sqlite`).

```bash
npm install
npm run dev          # Electron + Vite with hot reload
```

Other scripts:

| Script                | What it does                                            |
| --------------------- | ------------------------------------------------------- |
| `npm run lint`        | ESLint (TypeScript, React hooks, jsx-a11y)              |
| `npm run typecheck`   | `tsc` for the main/preload/shared and renderer projects |
| `npm test`            | Vitest (main-process logic and the React UI)            |
| `npm run build`       | Production build into `out/`                            |
| `npm run package`     | Build and create a Windows installer (`release/`)       |
| `npm run package:dir` | Unpacked app for the current OS, for quick smoke tests  |
| `npm run check`       | lint + typecheck + test + build                         |

### ffprobe

Rummage reads duration, container, codecs, resolution and frame rate with `ffprobe`. It looks for:

1. the path in the `RUMMAGE_FFPROBE_PATH` environment variable,
2. `<app resources>/bin/ffprobe(.exe)` (to ship one with the installer, add it via `extraResources`),
3. `ffprobe` on `PATH`.

Without ffprobe, files are still indexed and listed; they just have no technical details, and are
re-probed on the next rescan once ffprobe becomes available. Settings shows whether it was found.

## Architecture

```
src/shared/     Domain models + IPC contract + zod validators (no Node, no Electron)
src/main/       Electron main process
  core/           RummageProvider interface, ProviderRegistry, MediaService (facade the UI talks to)
  db/             Thin SQLite wrapper (node:sqlite behind an interface) + versioned migrations
  providers/local/ LocalLibraryProvider: scanner, ffprobe, identity strategy, store, media protocol
src/preload/    The narrow contextBridge API (`window.rummage`)
src/renderer/   React UI: design tokens, shared components, screens
tests/          Cross-cutting guards (e.g. no raw colors outside the token file)
```

### Provider model

Everything the UI sees is a normalized domain object (`src/shared/domain.ts`): `ProviderManifest`,
`MediaItem`, `MediaSource`, `MediaArtwork`, `PlaybackSource`. A `MediaItem` owns a list of
`MediaSource`s, each carrying its own `providerId`, so one item can later be available from several
providers. A provider implements:

```ts
interface RummageProvider {
  manifest: ProviderManifest
  getCatalog(request): Promise<CatalogPage>
  search(request): Promise<CatalogPage>
  getItem(id): Promise<MediaItem | null>
  resolvePlayback(id, { sourceId? }): Promise<PlaybackSource | null>
  sources?: SourceManagement   // optional capability: add/remove/rescan user-managed sources
}
```

`LocalLibraryProvider` is the only implementation. The UI never touches the filesystem and never
builds file URLs: playback goes through `resolvePlayback`, which returns an opaque URL on the
`rummage-media:` scheme.

### Media identity

`IdentityStrategy` (`providers/local/identity.ts`) decides when two scan results are the same file.
Phase 1 uses `path-v1`: a SHA-256 of the canonical path (case-folded on Windows). The scheme name is
stored with every key, items and sources are separate tables, and filesystem facts (size, mtime, file
id) are recorded alongside, so a content-fingerprint or server-id strategy can be added later
without a schema redesign. File names are never treated as unique.

### Database

SQLite file `rummage.db` in the app's user-data folder; schema in `src/main/db/migrations.ts`
(`PRAGMA user_version` migrations): `libraries`, `media_items`, `media_sources`, `media_metadata`,
plus scan timestamps/status on `libraries`. No accounts, nothing leaves the machine.

### Security model

- Renderer: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`,
  no `<webview>`, window opens denied, navigation locked to the bundled UI, all permissions denied
  except fullscreen, strict CSP.
- Preload exposes one object with fixed methods; each maps to one fixed channel. `ipcRenderer` is
  never exposed. Every handler checks the sender frame URL and validates arguments with strict zod
  schemas.
- "Add Your Stash" opens the folder picker in the **main** process; the renderer never supplies a path.
- Files are served only via `rummage-media://stream/<source-id>`. The handler resolves the id
  through the database, then re-checks on every request that the real path (symlinks resolved) is
  inside its library root and has an allow-listed video extension. Range requests are supported.
- The scanner only considers allow-listed video extensions, never follows symlinks/junctions,
  skips hidden and NAS system folders, and only prunes missing files after a fully readable walk
  (an offline share cannot wipe the index).
- ffprobe is run with `execFile` (no shell), a timeout and an output cap; its JSON is validated.

### Design system

`src/renderer/design/tokens.css` has two layers: Dumpsterlight brand primitives (`--dl-*`, the only
place raw colors exist) and semantic tokens (`--background-primary`, `--surface-card`,
`--text-muted`, `--accent-primary`, `--status-connected`, `--focus-ring`, ...). Components consume
semantic tokens only; a test enforces that no other stylesheet contains raw colors. Shared
components live in `src/renderer/components`: Button, Card, MediaCard, SectionHeader, SearchField,
Badge, EmptyState, Modal, NavigationItem, StatusIndicator (plus Icon, Spinner, Mascot, BrandMark).

Accessibility/TV groundwork: visible lime focus everywhere, large targets, rem-based sizing
(`data-ui-scale="tv"` scales the UI), reduced-motion support, text + icon status indicators, and
document-level arrow-key spatial navigation.

## Playback

Rummage plays what Chromium plays natively. Before loading a file it checks the container and codecs
with `canPlayType`; if the format can't be played (or the player reports an error) it shows a clear
"won't play here - yet" state instead of a broken player. A file whose only problem is an
undecodable audio track plays with a notice. There is no transcoding or remux.

## Deferred on purpose

Not implemented in Phase 1 (interfaces leave room, but there are no placeholders): SMB/NFS
discovery, Rummage Home Server, remote streaming, Jellyfin, Kodi compatibility (to be an adapter
layer, never embedded), Stremio-style providers, online catalogs / Free Finds, HLS/DASH,
FFmpeg remux/transcode, subtitles, thumbnail/artwork extraction and metadata enrichment,
watch state / Continue Watching / Watch Pile, accounts and sync, plugin repositories, sideloading,
plugin permissions and sandboxing.

## Known limitations

- Windows packaging is configured (NSIS installer) and an unpacked `Rummage.exe` builds, but the
  app was developed and exercised on Linux; run `npm run package` on Windows for the installer.
- `node:sqlite` is still flagged experimental by Node (a warning is printed); it is isolated behind
  `src/main/db/database.ts`. SQLite calls run on the main thread, which is fine at this scale.
- Cards use generated placeholder artwork until a provider supplies real artwork.
- Symlinked folders inside a library are intentionally not followed.
