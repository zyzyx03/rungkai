// Drawn marks, in the same 1.2px stroke as the environment glyphs. A glyph
// standing in for an icon is what makes a page look assembled, so the book
// and the external arrow are both paths.
export const MAN_PAGE_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4.4C6.7 3.4 4.9 3 2.8 3v8.4c2.1 0 3.9.4 5.2 1.4 1.3-1 3.1-1.4 5.2-1.4V3c-2.1 0-3.9.4-5.2 1.4Z"/><path d="M8 4.4v8.4"/></svg>`;
export const EXTERNAL_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.6 3.4H3.4v9.2h9.2V9.4"/><path d="M9.6 3.4h3v3"/><path d="M12.6 3.4 7.6 8.4"/></svg>`;
// Existing Unicode glyphs, not drawn paths. A snake for Python and a beaver
// for the Go/gopher joke; the OS supplies the artwork.
export const SNAKE_ICON = "\u{1F40D}";
export const GOPHER_ICON = "\u{1F9AB}";
