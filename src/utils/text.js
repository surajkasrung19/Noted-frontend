export function htmlToText(html = "") {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent || element.innerText || "";
}

export function tagsFromInput(value = "") {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function tagsToInput(tags = []) {
  return tags.join(", ");
}

export function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
