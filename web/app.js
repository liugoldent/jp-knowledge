const notes = window.JP_NOTES || [];
const byId = new Map(notes.map((note) => [note.id, note]));
const article = document.querySelector("#article");
const navigation = document.querySelector("#noteNavigation");
const searchInput = document.querySelector("#searchInput");
const sidebar = document.querySelector("#sidebar");
const menuButton = document.querySelector("#menuButton");
const backdrop = document.querySelector("#backdrop");
const themeButton = document.querySelector("#themeButton");

const categoryNames = { 首頁: "首頁", Lyrics: "歌詞", Grammer: "文法", Vocabulary: "單字" };

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function inline(text) {
  let value = escapeHtml(text);
  value = value.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
    const normalized = target.replace(/\.md$/, "");
    const found = byId.has(normalized) ? normalized : notes.find((note) => note.id.endsWith(`/${normalized}`))?.id;
    const title = label || target.split("/").pop();
    return found ? `<a href="#${encodeURIComponent(found)}">${title}</a>` : `<span>${title}</span>`;
  });
  value = value.replace(/`([^`]+)`/g, "<code>$1</code>");
  value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  value = value.replace(/  $/, "<br>");
  return value;
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const html = [];
  let listType = null;
  let quoteOpen = false;

  const closeList = () => {
    if (listType) html.push(`</${listType}>`);
    listType = null;
  };
  const closeQuote = () => {
    if (quoteOpen) html.push("</blockquote>");
    quoteOpen = false;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1] || "";

    if (/^\|.*\|$/.test(line) && /^\|?[\s:|-]+\|$/.test(next)) {
      closeList(); closeQuote();
      const headers = line.split("|").slice(1, -1);
      index += 2;
      const rows = [];
      while (index < lines.length && /^\|.*\|$/.test(lines[index])) {
        rows.push(lines[index].split("|").slice(1, -1));
        index += 1;
      }
      index -= 1;
      html.push('<div class="table-wrap"><table><thead><tr>', ...headers.map((cell) => `<th>${inline(cell.trim())}</th>`), "</tr></thead><tbody>");
      rows.forEach((row) => html.push("<tr>", ...row.map((cell) => `<td>${inline(cell.trim())}</td>`), "</tr>"));
      html.push("</tbody></table></div>");
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList(); closeQuote();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      closeList();
      if (!quoteOpen) { html.push("<blockquote>"); quoteOpen = true; }
      if (quote[1]) html.push(`<p>${inline(quote[1])}</p>`);
      continue;
    }
    closeQuote();

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      const requested = unordered ? "ul" : "ol";
      if (listType !== requested) { closeList(); html.push(`<${requested}>`); listType = requested; }
      html.push(`<li>${inline((unordered || ordered)[1])}</li>`);
      continue;
    }
    closeList();

    if (!line.trim() || /^---+$/.test(line.trim())) continue;
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList(); closeQuote();
  return html.join("\n");
}

function currentId() {
  const requested = decodeURIComponent(location.hash.slice(1));
  return byId.has(requested) ? requested : notes[0]?.id;
}

function renderNavigation(query = "") {
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = normalized
    ? notes.filter((note) => `${note.fullTitle}\n${note.markdown}`.toLocaleLowerCase().includes(normalized))
    : notes;

  navigation.innerHTML = "";
  if (!filtered.length) {
    navigation.innerHTML = '<p class="search-empty">找不到符合的筆記</p>';
    return;
  }

  const groups = Map.groupBy ? Map.groupBy(filtered, (note) => note.category) : filtered.reduce((map, note) => map.set(note.category, [...(map.get(note.category) || []), note]), new Map());
  groups.forEach((group, category) => {
    const section = document.createElement("section");
    section.className = "nav-section";
    section.innerHTML = `<h2>${categoryNames[category] || category}</h2>`;
    group.forEach((note) => {
      const link = document.createElement("a");
      link.className = `nav-link${note.id === currentId() ? " active" : ""}`;
      link.href = `#${encodeURIComponent(note.id)}`;
      link.textContent = note.title;
      section.append(link);
    });
    navigation.append(section);
  });
}

function renderArticle() {
  const note = byId.get(currentId());
  if (!note) return;
  article.innerHTML = `${markdownToHtml(note.markdown)}<div class="note-meta"><span>${categoryNames[note.category] || note.category}</span><span>${note.file}</span></div>`;
  document.title = `${note.title} · 日本語知識庫`;
  document.body.classList.remove("menu-open");
  renderNavigation(searchInput.value);
  window.scrollTo({ top: 0 });
  article.focus({ preventScroll: true });
}

searchInput.addEventListener("input", () => renderNavigation(searchInput.value));
menuButton.addEventListener("click", () => document.body.classList.toggle("menu-open"));
backdrop.addEventListener("click", () => document.body.classList.remove("menu-open"));
window.addEventListener("hashchange", renderArticle);
window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault(); searchInput.focus(); document.body.classList.add("menu-open");
  }
  if (event.key === "Escape") document.body.classList.remove("menu-open");
});

const savedTheme = localStorage.getItem("jp-theme");
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
themeButton.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("jp-theme", next);
});

renderNavigation();
renderArticle();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
