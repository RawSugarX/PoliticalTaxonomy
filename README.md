# Towards a new taxonomy of politics

A single-page, no-backend questionnaire built from `taxanomy.xlsx`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The page shell (four views: Introduction, Semantics, Questionnaire, Results). |
| `styles.css` | All styling, light + dark. |
| `app.js` | Routing, answer state, scoring, SVG charts. |
| `data.json` | The workbook mapped to JSON — canonical data. |
| `data.js` | Same JSON assigned to `window.TAXONOMY_DATA` so the page works from `file://`. |
| `tools/xlsx_to_json.py` | Regenerates both data files from the workbook (stdlib only). |
| `serve.py` | Optional static dev server (stdlib only) for running over `http://`. |
| `package.json` | Convenience scripts only — no dependencies. |

## Running

Open `index.html` directly in a browser — no server, no build step, no dependencies.

Or serve it over `http://` (useful for devtools, for fetching `data.json` directly,
and for opening it on a phone on the same network):

```
python3 serve.py            # http://localhost:8080
python3 serve.py 3000       # different port
npm start                   # same thing
```

`serve.py` is standard library only, so there is nothing to install. It serves this
directory read-only, sends `Cache-Control: no-store` so edits show up on reload, and
walks forward to the next free port if the one you asked for is busy. It also prints a
LAN address; pass `--host 127.0.0.1` to keep it local only.

If you would rather use the Node ecosystem, `npm run serve:node` shells out to
`npx http-server` — that one downloads a package on first run.

To regenerate the data after editing the workbook:

```
python3 tools/xlsx_to_json.py
```

## Data mapping

- **Introduction** sheet → `introduction` (lead paragraphs, the domain table, the nine-position grid, the terminology table).
- **The semantics of capitalism vs socialism** sheet → `semantics.paragraphs`.
- **Questions** sheet → `questions[]`: `dimension` (P), `type` (Q), `question` (R), `explanation` (S),
  and five `options`, each with the label (T:X) plus its **benefit** weight (F:J) and **control** weight (K:O).
- **Results** sheet → `reference[]`, the estimated positions of the historical figures shown on the charts.

## Scoring

Same as the workbook: for each dimension, sum the benefit weights of the chosen options and, separately,
the control weights, then clamp each sum to `[-100, 100]`. Negative is more equal / more popular control;
positive is more unequal / more elite control. Unanswered questions contribute nothing.

Answers live in `localStorage` only; nothing is sent anywhere.

## Editing question wording

Wording lives in `tools/xlsx_to_json.py`, in the `EDITS` table near the bottom — a per-question
list of ops (`q_append`, `e_append`, `q_replace`, `note`, `opt_set`, `opt_reverse`, `info`, …)
applied on top of what the sheet says. Change it there and re-run `python3 tools/xlsx_to_json.py`,
so re-generating from the workbook never loses the edits. The ops assert when their target text
is missing, so a spreadsheet change that invalidates an edit fails loudly instead of silently
doing nothing.

Two entries are marked `DRAFT` (Q9 and Q21) — placeholder examples awaiting real ones.

## Note on one cell

On the Questions sheet, `P3` (the Dimension cell for *"who should pass laws"*) holds an explanatory note about
"legal" vs "political" rather than a dimension name, so the workbook's `SUMIF` formulas silently exclude that
question from every total. Here it is counted under **Legal**, and the note is shown alongside the question.
