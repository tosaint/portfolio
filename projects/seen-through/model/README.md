# Seen Through — visual boundary study (v2.0 pretest)

A mobile web tool for studying how the visual boundary of a public toilet shapes privacy and safety. It is built on a 3D model of Shigeru Ban's transparent toilet at Haru-no-Ogawa Community Park, Shibuya (THE TOKYO TOILET, 2020).

手機網頁版公廁視覺邊界知覺調查（前測版）。

Each participant picks a booth (all-gender/accessible, women's or men's) and experiences four boundary states in that booth, in a balanced order. Only the outer glass walls and door leaf of the chosen booth change; geometry, fixtures, the mirror partition walls and the door lock stay the same. There is no material comparison: the opaque state is a plain light-grey wall with no texture.

| Code | Before entering | After locking | Represents |
|---|---|---|---|
| O | cannot see in | cannot see out | full visual isolation (plain opaque wall) |
| F | frosted | frosted | frosted-glass public toilet |
| A | clear | turns frosted | the real design |
| D | clear | stays clear | hypothetical full exposure |

- **A vs D** (inside): does turning opaque on locking protect privacy? Primary comparison.
- **A vs F** (outside): does seeing in before entering make people feel safer?
- **O vs F / A** (inside): is "cannot see" the same as "feel safe"?

## Files

| File | Role |
|---|---|
| `index.html` | 3D model (three.js r147). Free exploration by default. Adds `setSkin` (glass / opaque), `setHazeNow`, `setExpHaze` and passers-by (`startWalkers`, `clearWalkers`, `walkerInfo`) to `window.__tt`. Booth ② now has mirrors on both partition walls. |
| `study.js` | Participant mode (`?study=1`). |
| `study.json` | All wording and settings: scenarios, orders, booth poses, passers-by scripts, timing, questions, marking options. |
| `Code.gs` | Google Apps Script receiver: upserts five sheets by unique key, so resending never duplicates rows. |

## Flow per participant

1. Consent → practice in a neutral park view → lock check (outsiders cannot open; you can leave).
2. Choose a booth. All four scenarios happen in that booth.
3. Four scenarios in the assigned order (`OFDA` / `FAOD` / `ADFO` / `DOAF`, Williams-balanced). Daytime; walkers, a runner and a dog walker pass by on fixed scripts timed to the start of each observation. They only walk past and never look at the toilet.
   - Outside view, at least 8 s → O1–O4 (expectation) → O5 (what you can see now).
   - Door → open → enter → close → **lock**: same indicator, click sound and fixed `lockWaitMs` in every scenario; only A changes from clear to frosted.
   - Sit and observe for `insideViewSeconds` (15 s). **No questions here.**
   - Fade to a neutral screen *before* unlocking (so A's return to clear glass does not colour the answers) → R1–R7 recalling the seated period → (pretest T1–T2b) → M1 private-range marking + optional M2.
4. P1–P4, lock trust L1–L2 → (pretest T3–T4) → background. Familiarity with the Tokyo toilet (F1, F2, K1) and the film *Perfect Days* come last, so nothing gives the design away beforehand.
5. Data saved → ending film and debrief (explains that only A is the real design).

Main data per participant: 4 × (5 + 7) = **48 ratings** and **4 marks**. Pretest checks are stored separately and are not counted in the 48.

## URL parameters

- `?study=1` — participant mode (required; without it the page is the free-exploration model).
- `&g=1` … `&g=4` — researcher-assigned order group. Without it each phone draws a group at random, which does not guarantee equal group sizes.
- `&cfg=other.json` — alternative settings file.
- `&reset=1` — clear an unfinished session on this device.
- `&fov=60` — temporary horizontal field of view.

Refreshing keeps the participant code, booth and order group; the interrupted scenario restarts with `attemptNo + 1`.

## Data

`Code.gs` writes five sheets:

| Sheet | One row per | Unique key |
|---|---|---|
| `participants` | participant | studyId, pid |
| `ratings` | answered item | studyId, pid, trialId, checkpoint, questionId |
| `marks` | scenario (M1/M2) | studyId, pid, trialId |
| `pretestChecks` | T-item answer | studyId, pid, trialId, questionId |
| `events` | event | eventId |

- `checkpoint` is `outside` (O1–O5) or `inside_recall` (R1–R7).
- `responseValue` is null with `responseStatus = na_or_refused` when 無法判斷／不願回答 is ticked; it is never coded as the midpoint.
- `markDistanceM` is the distance along the walked route from the threshold (outside negative). Only `location` has a value (0 for `threshold`).
- `presentation` events record planned vs actual skin, haze, door, lock, camera, field of view, interior light and passer-by positions. `view` events record foreground viewing time, head rotation and how long each passer-by was inside the field of view. `manipulation_failure` is logged if the glass is not in the planned state when the lock wait ends.

## Connect Google Sheets

1. Open the Google Sheet → Extensions → Apps Script → replace the old code with `Code.gs`.
2. Deploy → Manage deployments → edit → New version (the URL stays the same), or create a new web-app deployment (Execute as: Me; Who has access: Anyone).
3. Opening the URL should return `{"ok":true,"service":"toilet-study","version":"2.0"}`.
4. `study.json` → `endpoint` must be that URL; `ALLOWED_STUDY_IDS` in `Code.gs` must include `haru-boundary`.

Until the new `Code.gs` is deployed, an older receiver rejects the new `studyId`; the debrief then shows the data as JSON for the participant to copy, so nothing is lost.

## Run locally

```
python -m http.server 8000
```

Then open `http://localhost:8000/?study=1&g=1`.

## Known limitations

- Geometry is reconstructed from the published plan and photos; it has not been measured on site.
- Booth ② left mirror follows a published site-visit record (K2・PLAN, 12 Oct 2020) and the TOTO Technical Center case page.
- Frosted glass is rendered as a heavy blur: passers-by beyond it are not visible as silhouettes. Real switchable glass may show faint shadows; T2b asks what participants noticed.
- Booth sizes, door types and seat orientations differ; booth choice is self-selected, so the booth enters the analysis as a covariate. In booth ② the seat view faces the door wall so the manipulated glass is in view.
- Mirrors do not show the participant's body.
- WebXR (headset) mode uses a different glass rendering path and has not been verified with this protocol.
- Viewing time and head rotation describe operation only; they are not eye tracking.
