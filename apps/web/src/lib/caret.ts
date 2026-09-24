const MIRRORED = [
  "box-sizing",
  "width",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "font-family",
  "font-size",
  "font-style",
  "font-variant",
  "font-weight",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "tab-size",
  "text-indent",
  "text-transform",
];

/**
 * Pixel position of `position` inside a textarea, relative to its top-left
 * corner — for anchoring the slash menu at the caret. Textareas don't
 * expose this, so it renders an invisible copy with identical text layout
 * and measures a marker at that offset.
 */
export function caretCoordinates(el: HTMLTextAreaElement, position: number) {
  const style = getComputedStyle(el);
  const mirror = document.createElement("div");
  for (const prop of MIRRORED) {
    mirror.style.setProperty(prop, style.getPropertyValue(prop));
  }
  Object.assign(mirror.style, {
    position: "absolute",
    visibility: "hidden",
    top: "0",
    left: "-9999px",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
  });
  mirror.textContent = el.value.slice(0, position);
  const marker = document.createElement("span");
  marker.textContent = el.value.slice(position) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.4;
  const coords = {
    // offsetTop/Left are measured inside the mirror's border; the menu is
    // positioned against the textarea's outer edge.
    top: marker.offsetTop + Number.parseFloat(style.borderTopWidth) - el.scrollTop,
    left: marker.offsetLeft + Number.parseFloat(style.borderLeftWidth) - el.scrollLeft,
    lineHeight,
  };
  mirror.remove();
  return coords;
}
