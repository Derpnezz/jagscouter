# JagScouter — JagBots4638

A clean, phone-first scouting website with desktop manager tools. Match observations
stay on each device and move to a manager by compressed QR code or CSV. There are
no accounts, backend calls, cloud sync, or form editors.

JagScouter is a **static GitHub Pages website**, including on phones—not an
Expo/native app. Its orange (`#ff8500`) and black (`#090909`) branding follows the
team's earlier website: compact controls, thin borders, and straightforward
data tables. The orange jaguar favicon is traced from the supplied historical
reference; it replaces the generic blue FRC icon. Game/season names are secondary
context, not the product name.

Website updates appear on the introductory/home page. Use **Refresh downloaded
website** while online, then **Apply update & reload** when an update is ready.
Do not clear site storage: that would remove scouting records and drafts.
Branding changes do not alter
the active game definition or saved-match interpretation.

## Use at an event

1. On **each** device, open the introductory/home page online over HTTPS and wait
   for **Ready for offline use** (or **Already up to date · ready for offline use**).
   This means a complete website bundle and active game definition
   have been cached, not simply that local libraries exist.
2. Optionally add the site to your phone's Home Screen.
3. Before leaving Wi-Fi, close the tab and reopen the same URL offline to confirm
   that your browser retains it.
4. Scouts fill Setup and freely switch among section tabs. Every input change
   saves the draft locally. **Save match & show QR** validates all sections, saves
   the match, and displays a QR code. **Next match** starts a fresh form; the
   completed match stays saved.
5. Managers use Collect to scan a QR (camera permission required) or scan an image
   using the scanner's file option. A pasted transfer code is also supported.
   Matches supports CSV import/export, team filtering, sorting, details, and
   confirmed deletion. Insights uses the selected form's own metric definitions.
6. Export backups frequently. Private browsing, clearing site data, device loss,
   and browser storage eviction can remove local matches and caches. Persistent
   storage is requested where supported but is **not guaranteed**, including on
   iOS. Camera access needs HTTPS and browser permission; offline use does not
   remove these requirements.

Storage errors are visible, not interpreted as successful saves or duplicate
scans. If saved data is unreadable, use **Download recovery backup** on the error
screen. It preserves the original raw storage strings without overwriting them.
Managers can also download a readable backup of all record objects. Recovery
JSON and preserved-draft JSON are recovery files, not form uploads; there is no
JSON configuration import in the UI.

## Yearly updates: edit one source JSON

The active form is **`config/game.json`**. Edit this file in website source, commit,
and publish the static files as usual. There is no in-app editor and no form upload.
Do not change the renderer for a form assembled from the supported blocks.

```json
{
  "schemaVersion": 1,
  "gameId": "example-2027",
  "name": "Example game",
  "season": 2027,
  "version": "1.0",
  "sections": [
    {
      "id": "auto",
      "label": "Auto",
      "description": "Observe autonomous actions.",
      "fields": [
        {
          "id": "autoPieces",
          "type": "counter",
          "label": "Pieces scored",
          "min": 0,
          "max": 99,
          "step": 1,
          "default": 0
        }
      ]
    }
  ],
  "metrics": [
    {
      "id": "pieces",
      "label": "Pieces per match",
      "operation": "sum",
      "fields": ["autoPieces"],
      "description": "Average observed autonomous pieces, not official points."
    }
  ]
}
```

Setup (team number, match number, alliance, optional scouter name) is shared across
games. The JSON controls every game-specific section, its order, labels, fields,
defaults, constraints, choices, and summary metrics. Notes are a configurable
text block, not a hard-coded exception.

### Reusable blocks

All fields require unique `id`, `type`, nonempty `label`, and a typed `default`.
Optional `help` provides explanatory text. IDs start with a letter and contain
only letters, digits, `_`, or `-` (up to 60 characters); unsafe object keys are
rejected. Section IDs are unique; `setup` is reserved.

| Type | Required settings | Behavior |
|---|---|---|
| `counter` | numeric `min`, `max`, positive `step`, numeric `default` | Large −/+ buttons and directly editable numeric value |
| `number` | numeric `min`, `max`, positive `step`, numeric `default` | Numeric input; decimal increments supported |
| `toggle` | boolean `default` | Accessible on/off switch |
| `choice` | `options: [{"value":"key","label":"Label"}]`, string `default` | One selected choice; unique option values |
| `rating` | numeric `min`, `max`, positive `step`, numeric `default` | Numeric choice buttons, at most 11 choices |
| `text` | integer `maxLength` (1–2000), string `default` | Single-line text; set `multiline: true` for notes |
| `multiSelect` | `options`, integer `minSelections`, `maxSelections`, array `default` | Select several independent observations |
| `duration` | numeric `min`, `max`, integer `precision`, numeric `default` | Stopwatch with Start/Pause, confirmed Reset, and editable elapsed seconds |
| `counterGrid` | `rows`, `columns`, `cells`, object `default` | Independently bounded counts for each row/column pair |

Text optionally supports `placeholder` and `required: true`; its blank default
is allowed but submission then requires nonblank text. Numeric values must stay
within their limits and align with `min + n * step`. Bounds are limited to
−100000 through 100000. There are at most 12 sections, 60 fields, 12 choices per
choice field, and 12 metrics. Field labels allow 100 characters and help 400.
Invalid definitions produce an actionable opening error rather than dropping
unsupported fields silently. Run `pnpm --filter @workspace/frc-scouting test`
before publishing.

### Additional source-configured observations

These blocks are optional; select only observations a scout can reliably collect.
They do not change the active REBUILT form. Unknown properties in form, section,
field, option, dimension, cell, and metric objects are rejected, rather than
silently ignored. Defaults and saved snapshots are independent deep copies.

**Multiple selections** (for example, STRONGHOLD defenses or pickup locations):

```json
{
  "id": "pickup", "type": "multiSelect", "label": "Pickup locations",
  "minSelections": 0, "maxSelections": 2, "default": [],
  "options": [
    {"value": "floor", "label": "Floor"},
    {"value": "substation", "label": "Substation"}
  ]
}
```

There are 1–12 options with unique safe string IDs (`value`) and nonempty labels.
Bounds must satisfy `0 <= minSelections <= maxSelections <= options.length`.
Answers are arrays of distinct configured IDs; duplicates/unknown IDs fail.
An empty default is allowed even when submission requires a minimum selection;
otherwise the default must satisfy the bounds. `required: true` requires at
least one selection and is incompatible with `maxSelections: 0`. At the maximum,
unselected buttons disable, but selected buttons remain available to deselect.
Keyboard Tab and Enter/Space work like the existing buttons.

**Duration/stopwatch** (optional cycle or climb observations, not an official rule):

```json
{
  "id": "cycleSeconds", "type": "duration", "label": "Observed cycle time",
  "min": 0, "max": 150, "precision": 1, "default": 0
}
```

Bounds are 0–3600 seconds. `precision` is 0–3 decimal places, defining the increment
as `10^-precision`; both bounds and answers must align to that precision.
Do not supply `step`. The saved answer is a finite numeric elapsed duration.
Start/Pause uses elapsed clock time, not interval counts. Timing continues while
switching section tabs, stops at the configured maximum, and pauses on leaving
the scouting page, saving a match, or hiding/closing the page via `pagehide`.
Reopening a draft restores elapsed seconds **paused**, never an automatic resume.
Direct correction pauses the timer; invalid/blank corrections cannot be saved
as a valid match. Reset requires confirmation and returns to `min`. The same
rules work offline. A default zero means untimed or zero-duration; numeric
summaries include those zeros, so do not interpret them as averages of only
measured cycles.

**Counter grid** (for example, CHARGED UP piece counts by row):

```json
{
  "id": "pieces", "type": "counterGrid", "label": "Pieces placed",
  "rows": [{"id": "high", "label": "High"}],
  "columns": [{"id": "cone", "label": "Cone"}, {"id": "cube", "label": "Cube"}],
  "cells": [
    {"id": "highCone", "row": "high", "column": "cone", "min": 0, "max": 99, "step": 1},
    {"id": "highCube", "row": "high", "column": "cube", "min": 0, "max": 99, "step": 1}
  ],
  "default": {"highCone": 0, "highCube": 0}
}
```

Provide 1–6 rows and 1–4 columns, each with unique safe `id` and nonempty `label`,
and exactly one cell for every pair (up to 24 cells). Cell IDs are unique and
stable, separate from row/column labels. Every cell supplies nonnegative integer
`min`, `max` (at most 100000), and positive integer `step`; max and values align
to `min + n * step`. The default and every saved answer contain **exactly** those
cell IDs with valid numeric values. Extra/missing keys, nonfinite numbers,
unknown row/column references, and repeated positions are rejected. Each cell
has direct entry and −/+ controls. Rows wrap into at most two columns on phones.
These counts describe only the observed robot, not alliance occupancy or points.

**Grid-layout choice** uses the existing scalar `choice` type:

```json
{
  "id": "start", "type": "choice", "label": "Starting lane",
  "layout": "grid", "columns": 3, "allowEmpty": true, "default": "",
  "options": [
    {"value": "left", "label": "Left"},
    {"value": "center", "label": "Center"},
    {"value": "right", "label": "Right"}
  ]
}
```

`layout` is `buttons` (also the default when omitted) or `grid`. Grid layout
requires `columns` 1–4 and places the normal 1–12 choices in source order.
Grid arrow keys and Home/End move focus; Enter/Space selects. Optional
`allowEmpty: true` adds a separate **Not observed** action without shifting the
grid positions; customize it with `emptyLabel`. Its answer is `""`, distinct
from every nonempty option ID. If `required: true`, an empty initial default is
allowed but an empty submitted answer fails. No images or season-specific maps
are needed.

Manager tables/details show option labels, seconds, and labeled cell counts.
Structured sorting is deterministic and ignores selection-array order.
CSV includes readable aggregate selections/cell labels and additional numeric
`answer:<fieldId>.<cellId>` columns; `recordJson` remains the authoritative typed
round-trip, preserving arrays/objects, labels, Unicode, and punctuation.
Large definitions/notes still trigger the existing single-QR size warning and
CSV backup option after the match has been saved; observations are never truncated.

### Supported metrics

Every metric requires a unique `id`, `label`, and explicit `description`.

- **`sum`**: `fields` references numeric fields. Add those values for each match,
  then average those match totals for each team. A single field yields that
  field's average.
- **`rate`**: `field` references a field and `values` lists its successful typed
  values (for example `[true]` or `["level2", "level3"]`). Show the percentage of
  a team's matches with one of those values.
- Set `metrics: []` if only raw observations are wanted.
- Duration fields support existing numeric sums/averages and scalar rates;
  grid-layout choices retain ordinary choice rates. `multiSelect` and
  `counterGrid` cannot be referenced by either metric operation: validation
  rejects structured-answer metrics instead of silently coercing them. Their
  raw observations remain readable and exportable.

The current REBUILT form records fuel in AUTO and in active-hub TELEOP, tower
outcomes, defense, observed fouls, and reliability notes. These are **scout
observations**, not an official scoring engine or ranking-point predictor.

### Representative past-game templates

`config/examples/reefscape-2025.json` illustrates CORAL levels, ALGAE targets,
CAGE outcomes, and numeric climb time. `config/examples/crescendo-2024.json`
illustrates NOTE targets, amplification, STAGE outcomes, ratings, and TRAP notes.
`config/examples/stronghold-2016.json` adds multiple crossed defenses, an optional
cycle stopwatch, and a starting-lane grid. `config/examples/charged-up-2023.json`
adds a complete 3×2 cone/cube-by-row counter grid, pickup selections, and an
optional balancing stopwatch. Together the source examples exercise every block.
To adopt one in source, copy its JSON into `config/game.json` and adjust identity,
fields, and constraints for your team. The example files are not downloaded by
the live app. They are **illustrative templates, not certified scoring systems**.

Research sources:

- [FIRST archived games](https://www.firstinspires.org/resource-library/frc/archived-game-documentation)
- [2026 REBUILT manual, match periods and hub status](https://firstfrc.blob.core.windows.net/frc2026/Manual/2026GameManual.pdf)
- [2025 REEFSCAPE manual, reef/processor/net and cages](https://firstfrc.blob.core.windows.net/frc2025/Manual/2025GameManual.pdf)
- [2024 CRESCENDO manual, amp/speaker/stage/trap](https://firstfrc.blob.core.windows.net/frc2024/Manual/2024GameManual.pdf)
- [2016 STRONGHOLD game manual, defenses](https://firstfrc.blob.core.windows.net/frc2016manuals/GameManual/FRC-2016-game-manual-03.pdf)
- [2023 CHARGED UP arena manual, scoring rows/nodes](https://firstfrc.blob.core.windows.net/frc2023/Manual/Sections/2023FRCGameManual-05.pdf)
- [FIRST scouting guide](https://www.firstinspires.org/sites/default/files/uploads/resource_library/frc/team-resources/scouting.pdf)

### Versioning and saved records

- Use a new `gameId` for a new game/season; bump `version` when changing a form's
  field meaning, choices, constraints, labels, or metrics. `schemaVersion: 1`
  identifies this configuration contract, not the season.
- Every new match carries its game ID, form version, typed answers, and a
  self-contained snapshot of the definition needed to interpret them.
- Manager groups and statistics use the **exact** definition, not just the version
  label. Accidentally changing a definition without bumping the version still
  produces separate groups. Key order alone does not change identity.
- Existing original REBUILT records retain their raw storage representation and
  are shown in a separate legacy group with their original fuel-phase fields.
  Unrecognized records stay preserved and exportable as a JSON backup; they are
  excluded from calculations rather than guessed at.
- Drafts are keyed to their exact definition. A changed definition starts a new
  form while keeping older drafts downloadable. Returning to the exact original
  definition recovers that draft.
- Unknown record/config schema versions, out-of-range answers, and mismatched
  identities are rejected on QR/CSV import. IDs deduplicate records. Importing
  an already-collected ID does not overwrite its data.

CSV exports include readable configured answer columns plus a quoted `recordJson`
column with the complete versioned record. Import uses that column for lossless
round-tripping (including booleans, labels, Unicode, commas, quotes, and line
breaks). Original legacy CSV files are accepted too. The complete import is
validated before a single storage write; a bad row aborts the import. The file
limit is 10 MB. Very large forms may exceed a single QR code: the match stays
saved, and the QR screen offers a CSV backup instead.

## Offline cache and website updates

`sw.js` caches a complete bundle containing the HTML, CSS, scripts, bundled
libraries, manifest, icon, and active JSON. Each bundle's identity is derived from
the downloaded contents. Thus **JSON-only changes are detected without editing
the service worker**.

- A prepared device loads its cached bundle. Readiness requires a controlling
  service worker and a cached active definition.
- Online startup, reconnection, or **Refresh downloaded website** downloads a candidate
  bundle. If any required file fails, it is not made active. Existing cached
  scouting remains usable.
- Readiness and refresh controls appear only on home, never above scouting,
  QR handoff, or manager screens. Background checks continue off home; returning
  home shows the latest result.
- Manual refresh requires internet, checks worker code as well as bundled files,
  and reports downloading, already up to date, update ready, or a failure. A
  second click cannot start another download while the first is running.
- A complete changed bundle offers **Apply update & reload**. Applying it requires
  confirmation, activates it, and reloads that tab. It does not erase matches,
  drafts, or names.
- Cancelling leaves the downloaded update ready for later. Cached complete
  updates may be applied offline; failed downloads leave the current cache usable.
- Open tabs are pinned to their original bundle, so a background check or an
  update in another tab does not replace files in a match already underway.
  Navigation/reload uses the newly active bundle.
- Historical bundles are retained to support pinned tabs. All browser storage
  remains subject to browser quotas and eviction. Backups are essential.

For a release involving multiple code files, deploy the directory atomically
where your host supports it; do not edit files individually on the live host.
HTTPS is required for service workers except on local development hosts.

## Static deployment and development

Keep `index.html` at the site root with `css/`, `js/`, and `config/` alongside it.
All website URLs are relative, so GitHub Pages project paths work.

### GitHub Pages

1. Publish the contents of this directory (including `sw.js`, `config/game.json`,
   `manifest.webmanifest`, and `icon.svg`) at the root of the selected branch.
2. In repository Settings → Pages, select that branch and the `/ (root)` folder.
3. Open the HTTPS Pages URL, then prepare each scouting device.

No React migration, server, or build step is needed on GitHub Pages. Do not open
`index.html` directly using `file://` if you need offline preparation or a camera.

### Replit / local development

- `pnpm --filter @workspace/frc-scouting dev`: static development server on `PORT`.
- `pnpm --filter @workspace/frc-scouting test`: configuration, record, storage,
  CSV, metrics, QR-capacity, and cache/update regression checks using Node.
- `pnpm --filter @workspace/frc-scouting build`: copies the static website into
  `dist/public` for the configured static publishing target. Original source
  layout is unchanged.

The existing libraries remain bundled locally: LZ String, QRCode, html5-qrcode,
and Chart.js. Current insights use metric cards/tables; no CDN is required.