// SVG icon templates for the editor toolbar
// 24x24 viewBox, stroke-based, no emoji

const s = (d, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`

export const icons = {
  cursor: s('<path d="M5 3l14 8-6 1-3 6z"/><path d="M13 12l4 4"/>'),
  brush: s('<path d="M18 4l2 2-9 9-4 1 1-4z"/><path d="M7 16c-2 0-4 2-4 4h4c0-2 0-4-1-4z"/>'),
  eraser: s('<path d="M7 21h10"/><path d="M16 4l4 4-9 9H6l-2-2z"/>'),
  pan: s('<path d="M18 11V6a2 2 0 00-4 0"/><path d="M14 10V4a2 2 0 00-4 0v6"/><path d="M10 9.5V6a2 2 0 00-4 0v8"/><path d="M18 11a2 2 0 014 0v3a8 8 0 01-8 8h-2c-4 0-6-2-8-5l-1-2a2 2 0 013-2h1"/>'),
  plusSquare: s('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>'),
  upload: s('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
  replace: s('<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0115-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/>'),
  text: s('<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>'),
  undo: s('<polyline points="1 4 1 10 7 10"/><path d="M3.5 14a9 9 0 109-9.5L1 10"/>'),
  redo: s('<polyline points="23 4 23 10 17 10"/><path d="M20.5 14a9 9 0 11-9-9.5L23 10"/>'),
  crosshair: s('<circle cx="12" cy="12" r="7"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>'),
  fit: s('<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>'),
  resetView: s('<path d="M3 12a9 9 0 1018 0 9 9 0 00-18 0z"/><path d="M12 7v5l3 2"/>'),
  trash: s('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 6V4a2 2 0 012-2h0a2 2 0 012 2v2"/>'),
  more: s('<circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>', ' stroke-width="0"'),
  copy: s('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>'),
  crop: s('<path d="M6 2v14a2 2 0 002 2h14"/><path d="M18 22V8a2 2 0 00-2-2H2"/>'),
  flipX: s('<path d="M12 2v20"/><path d="M8 8L4 12l4 4"/><path d="M16 8l4 4-4 4"/>'),
  flipY: s('<path d="M2 12h20"/><path d="M8 8L12 4l4 4"/><path d="M8 16l4 4 4-4"/>'),
  rotate: s('<path d="M21 2v6h-6"/><path d="M21 13a9 9 0 11-3-7.7L21 8"/>'),
  reset: s('<path d="M3 2v6h6"/><path d="M3 13a9 9 0 103-7.7L3 8"/>'),
  image: s('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
  download: s('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  fileJson: s('<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
  fileImport: s('<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6"/><path d="M12 12l3 3-3 3"/>'),
  maximize: s('<path d="M8 3H5a2 2 0 00-2 2v3"/><path d="M21 8V5a2 2 0 00-2-2h-3"/><path d="M3 16v3a2 2 0 002 2h3"/><path d="M16 21h3a2 2 0 002-2v-3"/>'),
  eyedropper: s('<path d="M16.2 3.8a2.8 2.8 0 014 4L14 14l-4 1 1-4z"/><path d="M9 15l-4 4"/>'),
  close: s('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  check: s('<polyline points="4 12 9 17 20 6"/>'),
  squareCenter: s('<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>'),
  fullImage: s('<path d="M3 7V5a2 2 0 012-2h2"/><path d="M17 3h2a2 2 0 012 2v2"/><path d="M21 17v2a2 2 0 01-2 2h-2"/><path d="M7 21H5a2 2 0 01-2-2v-2"/>'),
  zoomIn: s('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>'),
  zoomOut: s('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>'),
  sun: s('<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/>'),
  sliders: s('<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'),
}
