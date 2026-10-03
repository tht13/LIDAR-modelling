/**
 * Helper to parse an HTML string into a DOM element.
 */
export function createElement<T extends HTMLElement = HTMLElement>(html: string): T {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild as T;
}
