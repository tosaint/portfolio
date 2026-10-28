# tosaint 余致賢 · Portfolio and CV

A personal portfolio and website CV for Xian Yu (余致賢), student of architecture in Taoyuan, Taiwan.

The site is designed like a small gallery at night. Each project is a "room" with a large catalogue number, a framed image and a wall label (year, medium, role, description). The CV sits in the About section at the end.

**Live site:** https://tosaint.github.io/portfolio/

## How it works

The page layout and the content are kept apart. The HTML only contains empty sections. When the page loads, `main.js` reads two data files and builds the page from them:

```
index.html          page structure (empty sections)
style.css           all styling, dark and light themes
main.js             reads the JSON files and renders the page
data/profile.json   name, quote, about text, education
data/projects.json  one entry per project
images/             project images
```

No framework, build step or template is used. The site is plain HTML, CSS and JavaScript.

## How to update the content

**Add a project.** Add one entry to the end of `data/projects.json`:

```json
{
  "title": "Project title",
  "title_zh": "中文標題 (optional)",
  "year": "2026",
  "status": "in-progress",
  "medium": ["three.js", "Google Apps Script"],
  "role": "Design, development",
  "summary": "Two or three sentences about what it is and what it does.",
  "image": "images/project-title.jpg",
  "link": "https://link-to-the-project"
}
```

- The entry gets the next catalogue number automatically (001, 002, …) and appears first on the page.
- `status` is one of `completed`, `in-progress` or `concept`.
- Add `"hidden": true` to keep an entry in the file but leave it off the page.
- `image` and `link` can be left empty (`""`). Without an image, an empty frame is shown.
- Put image files in the `images/` folder. A 4:3 landscape image fits the frame best.

**Edit the CV or about text.** Change `data/profile.json`. An education or experience entry with an empty `detail` is shown as a single line; with a `detail`, it can be expanded.

HTML, CSS and JavaScript do not need to change for either of these.

## Run it locally

The page loads its data with `fetch`, which browsers block for files opened directly from disk. Start a local server in the project folder:

```bash
python3 -m http.server
```

Then open http://localhost:8000.

## Deployment

The site is hosted on GitHub Pages:

1. Push this folder to a GitHub repository.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
4. After about a minute the site is live at the address shown on that page.

Every later push to `main` updates the live site automatically. The empty `.nojekyll` file tells GitHub Pages to serve the files as they are, without processing them.

## Process

The visual direction (dark gallery, one project per room, catalogue numbers) was chosen from two sketched directions. The layout, styles and script were written for this site with the help of an AI assistant (Claude); no theme or template was used. Commit history in this repository records how the site developed.
