// Reads data/profile.json and data/projects.json and builds the page.
// To add a project, add one entry at the END of projects.json.
// It gets the next catalogue number and appears first in the gallery.

const STATUS = {
  "completed": "Completed",
  "in-progress": "In progress",
  "concept": "Concept"
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));
const pad = (n) => String(n).padStart(3, "0");

async function getJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return res.json();
}

function renderEntrance(p) {
  document.getElementById("mark").innerHTML = `${esc(p.name)}<span>${esc(p.name_zh)}</span>`;
  document.getElementById("entrance").innerHTML = `
    <p class="eyebrow">${esc(p.role)}</p>
    <h1>${esc(p.name)}<span class="zh">${esc(p.name_zh)}</span></h1>
    <p class="statement">${esc(p.statement)}</p>
    <div class="coords">
      <p>${esc(p.location)}</p>
      ${(p.education || []).slice(0, 1).map((e) => `<p class="degree">${esc(e.title)}<br>${esc(e.org)}</p>`).join("")}
    </div>`;
}

function renderWorks(projects) {
  const numbered = projects.map((w, i) => ({ ...w, no: pad(i + 1) })).reverse();
  document.getElementById("count").textContent =
    `${numbered.length} ${numbered.length === 1 ? "work" : "works"}, newest first`;

  document.getElementById("works-list").innerHTML = numbered.map((w) => {
    const plate = w.image
      ? `<figure class="plate"><img src="${esc(w.image)}" alt="${esc(w.title)}" loading="lazy"></figure>`
      : `<figure class="plate empty"><figcaption>Plate ${w.no} · image to come</figcaption></figure>`;
    const status = STATUS[w.status] ? w.status : "concept";
    return `
    <article class="work" id="work-${w.no}">
      <div class="no" aria-hidden="true">${w.no}</div>
      ${plate}
      <div class="label">
        <p class="label-top">No. ${w.no}<span class="status ${status}">${STATUS[status]}</span></p>
        <h3>${esc(w.title)}</h3>
        ${w.title_zh ? `<p class="zh">${esc(w.title_zh)}</p>` : ""}
        <dl class="meta">
          <dt>Year</dt><dd>${esc(w.year)}</dd>
          <dt>Medium</dt><dd>${esc((w.medium || []).join(", "))}</dd>
          ${w.role ? `<dt>Role</dt><dd>${esc(w.role)}</dd>` : ""}
        </dl>
        <p class="desc">${esc(w.summary)}</p>
        ${w.link ? `<a class="go" href="${esc(w.link)}" target="_blank" rel="noopener">View project →</a>` : ""}
      </div>
    </article>`;
  }).join("");

  document.getElementById("checklist").innerHTML = numbered.map((w) => `
    <tr>
      <td class="n">${w.no}</td>
      <td><a href="#work-${w.no}">${esc(w.title)}</a>${w.title_zh ? `<span class="zh">${esc(w.title_zh)}</span>` : ""}</td>
      <td class="y">${esc(w.year)}</td>
      <td class="y">${esc(STATUS[w.status] || "Concept")}</td>
    </tr>`).join("");
}

function cvGroup(title, items) {
  if (!items || !items.length) return "";
  return `<section><h3>${esc(title)}</h3>${items.map((e) => `
    <details class="${e.detail ? "has-detail" : ""}">
      <summary${e.detail ? "" : ' tabindex="-1" onclick="return false"'}>
        <span class="p">${esc(e.period)}</span>
        <span class="t"><strong>${esc(e.title)}</strong><span>${esc(e.org)}</span></span>
      </summary>
      ${e.detail ? `<p class="d">${esc(e.detail)}</p>` : ""}
    </details>`).join("")}</section>`;
}

function renderAbout(p) {
  const links = (p.links || []).map((l) =>
    `<p>${esc(l.label)}: <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.url.replace(/^https?:\/\//, ""))}</a></p>`
  ).join("");
  document.getElementById("about-body").innerHTML = `
    <div class="about-text">
      ${(p.about || []).map((t) => `<p>${esc(t)}</p>`).join("")}
      <div class="contact">
        <p>Email: ${esc(p.email)}</p>
        ${links}
      </div>
    </div>
    <div class="cv">
      ${cvGroup("Experience", p.experience)}
      ${cvGroup("Education", p.education)}
      ${p.skills && p.skills.length ? `<section><h3>Skills</h3><dl class="skills">${p.skills.map((s) =>
        `<div><dt>${esc(s.group)}</dt><dd>${esc(s.items.join(", "))}</dd></div>`).join("")}</dl></section>` : ""}
    </div>`;
  document.getElementById("updated").textContent = `Last updated ${p.updated || ""}`;
}

function setupTheme() {
  const btn = document.getElementById("theme");
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) {}
  if (saved) root.dataset.theme = saved;
  const current = () => root.dataset.theme ||
    (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const label = () => { btn.textContent = current() === "dark" ? "Light" : "Dark"; };
  label();
  btn.addEventListener("click", () => {
    root.dataset.theme = current() === "dark" ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
    label();
  });
}

async function main() {
  setupTheme();
  try {
    const [profile, projects] = await Promise.all([
      getJSON("data/profile.json"),
      getJSON("data/projects.json")
    ]);
    document.title = `${profile.name} ${profile.name_zh}`;
    renderEntrance(profile);
    renderWorks(projects.filter((w) => !w.hidden));
    renderAbout(profile);
  } catch (err) {
    document.getElementById("works-list").innerHTML =
      `<p class="err">Could not load the site data (${esc(err.message)}). ` +
      `If you opened index.html directly from your computer, run a local server instead: ` +
      `python3 -m http.server, then open http://localhost:8000.</p>`;
  }
}

main();
