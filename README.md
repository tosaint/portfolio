# tosaint 余致賢 · Portfolio and CV

A personal portfolio and website CV for tosaint (余致賢), Master's student in Architecture at NTUST, Taiwan.

**Live site:** https://tosaint.com/portfolio/
**Home page:** https://tosaint.com/ (kept in a separate repository, [tosaint/tosaint.github.io](https://github.com/tosaint/tosaint.github.io))

## The idea

The site follows one line from the *Zhuangzi*: 虛室生白, "an empty room fills with light". Pages use a warm paper colour, ink-grey type and a lot of empty space.

- **Home page:** only the name, a link to the portfolio and slow rings that appear and fade, drawn from the plan of my wood work *Water's Echo in Wood*. Moving the mouse or touching the screen opens new rings.
- **Portfolio (this repository):** each work has a small catalogue number, a framed image and a short label (year, medium, size, award). On this page every work is shown as a black-and-white line drawing, so the page stays calm.
- **Work pages:** opening a work shows the real colour photographs and the full description.

Light and dark themes are both available; the choice is shared between the home page and the portfolio.

## How it works

Content and layout are kept apart. `index.html` only contains empty sections. When the page loads, `main.js` reads two data files and builds the work cards, the index table and the CV from them.

```
index.html             page structure (empty sections)
style.css              all styling, light and dark themes
main.js                reads the JSON files and renders the page
data/profile.json      name, quote, about text, education, contact
data/projects.json     one entry per work
projects/gchair/       work page: 高音譜椅 Gchair (photos + line drawing)
projects/water-echo/   work page: 水聲木 Water's Echo in Wood
projects/seen-through/ research page: Seen Through, with the 3D study in model/
images/                other images
```

```
profile.json + projects.json  →  main.js  →  work cards, index and CV  →  website
```

No framework, build step or template is used. The site is plain HTML, CSS and JavaScript.

## How to update the content

**Add a work.** Add one entry to `data/projects.json`:

```json
{
  "title": "Work title",
  "title_zh": "中文標題",
  "year": "2026",
  "status": "completed",
  "medium": ["Plywood"],
  "size": "180 × 180 × 18 cm",
  "award": "Selected, 2008 Taiwan International Wood Sculpture Competition",
  "summary": "One or two sentences about the work.",
  "image": "projects/work-name/img/line.svg",
  "image_style": "line",
  "link": "projects/work-name/"
}
```

- Works are numbered automatically in the order of the file, starting at 000, and the newest appears first on the page.
- `status` is one of `completed`, `in-progress` or `concept`.
- `size`, `award` and `role` are optional. `award` can also be a list, for more than one award.
- `"image_style": "line"` shows the image as a line drawing on the paper: its white background disappears, and in the dark theme the lines turn light. Leave it out for an ordinary photo.
- Add `"hidden": true` to keep an entry in the file but leave it off the page.

**Edit the CV or about text.** Change `data/profile.json`. Education entries can have a short `note`, such as research interests.

HTML, CSS and JavaScript do not need to change for either of these.

**Work pages.** Each work page in `projects/` is its own small HTML page, made by hand, because each work needs a different set of photos and texts. The research page *Seen Through* is much longer, with sections, tables and references. Photos are saved again before upload, so they carry no location or camera data.

## Run it locally

The page loads its data with `fetch`, which browsers block for files opened directly from disk. Start a local server in the project folder:

```bash
python3 -m http.server
```

Then open http://localhost:8000.

## Deployment

The site is hosted on GitHub Pages (**Settings → Pages → Deploy from a branch**, branch `main`, folder `/ (root)`). Every push to `main` updates the live site after about a minute. The empty `.nojekyll` file tells GitHub Pages to serve the files as they are.

The domain `tosaint.com` was bought on Cloudflare. Its DNS points to GitHub Pages (four A records and a `www` CNAME, DNS only), and the custom domain is set in the home page repository. This repository is served under it at `/portfolio/`; the old address `tosaint.github.io/portfolio/` redirects there.

## Tools

- HTML, CSS and JavaScript, written for this site; fonts from Google Fonts (Noto Serif TC, IBM Plex)
- three.js and Google Apps Script for the *Seen Through* 3D study
- Git and GitHub for version control, GitHub Pages for hosting, Cloudflare for the domain
- Claude (an AI assistant) for design discussion and code

## Process

The site was developed with an AI assistant through many rounds of description, review and correction. It started as a dark "night gallery" with very large catalogue numbers. After comparing three sample directions for the home page (a quiet Japanese style, a Korean corner grid and a refined version of the first design), the quiet Japanese direction was chosen, and the portfolio was changed to the same paper colours and line drawings. Problems in the AI's output were corrected by reviewing screenshots: for example, the first line drawing of the chair looked too simple, so it was redrawn with the thickness of each steel tube. The commit history records each of these steps.
