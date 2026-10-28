// Phosphor glyphs (MIT, see icons/LICENSE.md) for the Solar names Tally uses, copied from
// Qorelly packages/ui/src/icons/generated/Phosphor/{light,fill}.ts with the name map from its
// phosphor-icons.tsx. To add a name: copy its map entry and both glyph entries from there.

export type Shape = [string, Record<string, string>];

/** Solar name → Phosphor glyph, as Qorelly Design V2 draws it. */
export const SOLAR_TO_PHOSPHOR = {
  "Add-Circle": "plus",
  "Alt-Arrow-Down": "caret-down",
  "Alt-Arrow-Left": "caret-left",
  "Alt-Arrow-Right": "caret-right",
  "Alt-Arrow-Up": "caret-up",
  "Arrow-Left": "arrow-left",
  "Arrow-Right": "arrow-right",
  "Box": "package",
  "Buildings": "buildings",
  "Chart": "chart-bar",
  "Check-Circle": "check-circle",
  "Chef-Hat": "chef-hat",
  "Clock-Circle": "clock",
  "Close-Circle": "x",
  "Copy": "copy",
  "Danger-Circle": "warning-circle",
  "Danger-Triangle": "warning",
  "Delivery": "truck",
  "Eye": "eye",
  "Eye-Closed": "eye-closed",
  "File-Text": "file-text",
  "Gallery-Add": "image",
  "Graph-Up": "chart-line-up",
  "Hamburger-Menu": "list",
  "History": "clock-counter-clockwise",
  "Info-Circle": "info",
  "Layers": "stack",
  "Letter": "envelope-simple",
  "List-Check": "list-checks",
  "Lock": "lock",
  "Logout-2": "sign-out",
  "Magnifer": "magnifying-glass",
  "Menu-Dots": "dots-three",
  "Minus-Circle": "minus",
  "Mirror": "flower-lotus",
  "Moon": "moon",
  "Pen": "pencil-simple",
  "Pills": "pill",
  "Plate": "fork-knife",
  "Refresh": "arrows-clockwise",
  "Rounded-Magnifer": "magnifying-glass",
  "Settings": "gear",
  "Shop": "storefront",
  "Sidebar-Minimalistic": "sidebar-simple",
  "Stars": "sparkle",
  "Sun-2": "sun",
  "Tag": "tag",
  "Trash-Bin-Minimalistic": "trash-simple",
  "Upload-Minimalistic": "upload-simple",
  "User-Circle": "user-circle",
  "Widget-4": "layout",
  "Widget-5": "squares-four",
} as const;

export const LIGHT: Record<string, Shape[]> = {
  "arrow-left": [
    ["line", {"x1":"216","y1":"128","x2":"40","y2":"128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"112 56 40 128 112 200","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "arrow-right": [
    ["line", {"x1":"40","y1":"128","x2":"216","y2":"128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"144 56 216 128 144 200","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "arrows-clockwise": [
    ["polyline", {"points":"168 96 216 96 216 48","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M216,96,187.72,67.72A88,88,0,0,0,64,67","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"88 160 40 160 40 208","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M40,160l28.28,28.28A88,88,0,0,0,192,189","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "buildings": [
    ["path", {"d":"M136,216V32a8,8,0,0,0-12.44-6.65l-80,53.33A8,8,0,0,0,40,85.35V216","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M136,88h72a8,8,0,0,1,8,8V216","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"16","y1":"216","x2":"240","y2":"216","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"104","y1":"112","x2":"104","y2":"128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"72","y1":"112","x2":"72","y2":"128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"72","y1":"168","x2":"72","y2":"184","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"104","y1":"168","x2":"104","y2":"184","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "caret-down": [
    ["polyline", {"points":"208 96 128 176 48 96","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "caret-left": [
    ["polyline", {"points":"160 208 80 128 160 48","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "caret-right": [
    ["polyline", {"points":"96 48 176 128 96 208","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "caret-up": [
    ["polyline", {"points":"48 160 128 80 208 160","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "chart-bar": [
    ["polyline", {"points":"48 208 48 136 96 136","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"224","y1":"208","x2":"32","y2":"208","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"96 208 96 88 152 88","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"152 208 152 40 208 40 208 208","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "chart-line-up": [
    ["polyline", {"points":"224 208 32 208 32 48","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"200 72 128 144 96 112 32 176","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"200 112 200 72 160 72","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "check-circle": [
    ["polyline", {"points":"88 136 112 160 168 104","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["circle", {"cx":"128","cy":"128","r":"96","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "chef-hat": [
    ["line", {"x1":"96","y1":"160","x2":"88","y2":"128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"160","y1":"160","x2":"168","y2":"128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"128","y1":"160","x2":"128","y2":"128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M173.65,65.12A48,48,0,1,1,184,160H72A48,48,0,1,1,82.35,65.12","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M80,80a48,48,0,0,1,96,0","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M200,157.27V208a8,8,0,0,1-8,8H64a8,8,0,0,1-8-8V157.27","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "clock": [
    ["circle", {"cx":"128","cy":"128","r":"96","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"128 72 128 128 184 128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "clock-counter-clockwise": [
    ["polyline", {"points":"128 80 128 128 168 152","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"72 104 32 104 32 64","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M67.6,192A88,88,0,1,0,65.77,65.77C54,77.69,44.28,88.93,32,104","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "copy": [
    ["polyline", {"points":"168 168 216 168 216 40 88 40 88 88","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["rect", {"x":"40","y":"88","width":"128","height":"128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "dots-three": [
    ["circle", {"cx":"128","cy":"128","r":"10"}],
    ["circle", {"cx":"60","cy":"128","r":"10"}],
    ["circle", {"cx":"196","cy":"128","r":"10"}],
  ],
  "envelope-simple": [
    ["path", {"d":"M32,56H224a0,0,0,0,1,0,0V192a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V56A0,0,0,0,1,32,56Z","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"224 56 128 144 32 56","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "eye": [
    ["path", {"d":"M128,56C48,56,16,128,16,128s32,72,112,72,112-72,112-72S208,56,128,56Z","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["circle", {"cx":"128","cy":"128","r":"40","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "eye-closed": [
    ["path", {"d":"M32,104c16.81,20.81,47.63,48,96,48s79.19-27.19,96-48","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"224","y1":"168","x2":"200.62","y2":"127.09","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"160","y1":"192","x2":"152.91","y2":"149.45","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"96","y1":"192","x2":"103.09","y2":"149.45","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"32","y1":"168","x2":"55.38","y2":"127.09","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "file-text": [
    ["path", {"d":"M200,224H56a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h96l56,56V216A8,8,0,0,1,200,224Z","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"152 32 152 88 208 88","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"96","y1":"136","x2":"160","y2":"136","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"96","y1":"168","x2":"160","y2":"168","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "flower-lotus": [
    ["path", {"d":"M128,200s40-22,40-80.82c0-46-24.55-69.54-35.19-77.56a8,8,0,0,0-9.62,0C112.55,49.64,88,73.14,88,119.18,88,178,128,200,128,200Z","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M94.6,80.8C81.28,70,68.56,65.79,61,64.18a8.2,8.2,0,0,0-9.52,5.52c-3.88,12-8.78,39.66,11.11,74.27s53.07,53.4,65.37,56","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M161.4,80.8c13.32-10.82,26-15,33.56-16.62a8.2,8.2,0,0,1,9.52,5.52c3.88,12,8.78,39.66-11.11,74.27S140.3,197.37,128,200","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M128,200c15.37,0,40.77-.18,70-17.64s38.69-39.34,41.72-50.54a7.94,7.94,0,0,0-5.46-9.78,69.59,69.59,0,0,0-30.82-.64","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M52.56,121.4a69.59,69.59,0,0,0-30.82.64,7.94,7.94,0,0,0-5.46,9.78c3,11.2,12.49,33.07,41.72,50.54S112.63,200,128,200","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "fork-knife": [
    ["line", {"x1":"80","y1":"40","x2":"80","y2":"88","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"80","y1":"128","x2":"80","y2":"224","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M208,168H152s0-104,56-128V224","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M48,40,40,88a40,40,0,0,0,80,0l-8-48","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "gear": [
    ["circle", {"cx":"128","cy":"128","r":"40","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M41.43,178.09A99.14,99.14,0,0,1,31.36,153.8l16.78-21a81.59,81.59,0,0,1,0-9.64l-16.77-21a99.43,99.43,0,0,1,10.05-24.3l26.71-3a81,81,0,0,1,6.81-6.81l3-26.7A99.14,99.14,0,0,1,102.2,31.36l21,16.78a81.59,81.59,0,0,1,9.64,0l21-16.77a99.43,99.43,0,0,1,24.3,10.05l3,26.71a81,81,0,0,1,6.81,6.81l26.7,3a99.14,99.14,0,0,1,10.07,24.29l-16.78,21a81.59,81.59,0,0,1,0,9.64l16.77,21a99.43,99.43,0,0,1-10,24.3l-26.71,3a81,81,0,0,1-6.81,6.81l-3,26.7a99.14,99.14,0,0,1-24.29,10.07l-21-16.78a81.59,81.59,0,0,1-9.64,0l-21,16.77a99.43,99.43,0,0,1-24.3-10l-3-26.71a81,81,0,0,1-6.81-6.81Z","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "image": [
    ["rect", {"x":"32","y":"48","width":"192","height":"160","rx":"8","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["circle", {"cx":"156","cy":"100","r":"10"}],
    ["path", {"d":"M147.31,164,173,138.34a8,8,0,0,1,11.31,0L224,178.06","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M32,168.69l54.34-54.35a8,8,0,0,1,11.32,0L191.31,208","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "info": [
    ["path", {"d":"M120,120a8,8,0,0,1,8,8v40a8,8,0,0,0,8,8","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["circle", {"cx":"124","cy":"84","r":"10"}],
    ["circle", {"cx":"128","cy":"128","r":"96","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "layout": [
    ["line", {"x1":"104","y1":"104","x2":"104","y2":"208","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"32","y1":"104","x2":"224","y2":"104","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["rect", {"x":"32","y":"48","width":"192","height":"160","rx":"8","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "list": [
    ["line", {"x1":"40","y1":"128","x2":"216","y2":"128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"40","y1":"64","x2":"216","y2":"64","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"40","y1":"192","x2":"216","y2":"192","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "list-checks": [
    ["line", {"x1":"128","y1":"128","x2":"216","y2":"128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"128","y1":"64","x2":"216","y2":"64","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"128","y1":"192","x2":"216","y2":"192","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"40 64 56 80 88 48","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"40 128 56 144 88 112","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"40 192 56 208 88 176","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "lock": [
    ["rect", {"x":"40","y":"88","width":"176","height":"128","rx":"8","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["circle", {"cx":"128","cy":"152","r":"10"}],
    ["path", {"d":"M88,88V56a40,40,0,0,1,80,0V88","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "magnifying-glass": [
    ["circle", {"cx":"112","cy":"112","r":"80","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"168.57","y1":"168.57","x2":"224","y2":"224","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "minus": [
    ["line", {"x1":"40","y1":"128","x2":"216","y2":"128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "moon": [
    ["path", {"d":"M108.11,28.11A96.09,96.09,0,0,0,227.89,147.89,96,96,0,1,1,108.11,28.11Z","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "package": [
    ["polyline", {"points":"32.7 76.92 128 129.08 223.3 76.92","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"128","y1":"129.09","x2":"128","y2":"231.97","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M219.84,182.84l-88,48.18a8,8,0,0,1-7.68,0l-88-48.18a8,8,0,0,1-4.16-7V80.18a8,8,0,0,1,4.16-7l88-48.18a8,8,0,0,1,7.68,0l88,48.18a8,8,0,0,1,4.16,7v95.64A8,8,0,0,1,219.84,182.84Z","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"81.56 48.31 176 100 176 152","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "pencil-simple": [
    ["path", {"d":"M92.69,216H48a8,8,0,0,1-8-8V163.31a8,8,0,0,1,2.34-5.65L165.66,34.34a8,8,0,0,1,11.31,0L221.66,79a8,8,0,0,1,0,11.31L98.34,213.66A8,8,0,0,1,92.69,216Z","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"136","y1":"64","x2":"192","y2":"120","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "pill": [
    ["rect", {"x":"10.98","y":"82.75","width":"234.04","height":"90.51","rx":"45.25","transform":"translate(-53.02 128) rotate(-45)","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"96","y1":"96","x2":"160","y2":"160","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"160","y1":"112","x2":"184","y2":"88","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "plus": [
    ["line", {"x1":"40","y1":"128","x2":"216","y2":"128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"128","y1":"40","x2":"128","y2":"216","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "sidebar-simple": [
    ["line", {"x1":"88","y1":"48","x2":"88","y2":"208","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["rect", {"x":"32","y":"48","width":"192","height":"160","rx":"8","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "sign-out": [
    ["polyline", {"points":"112 40 48 40 48 216 112 216","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"112","y1":"128","x2":"224","y2":"128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"184 88 224 128 184 168","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "sparkle": [
    ["path", {"d":"M84.27,171.73l-55.09-20.3a7.92,7.92,0,0,1,0-14.86l55.09-20.3,20.3-55.09a7.92,7.92,0,0,1,14.86,0l20.3,55.09,55.09,20.3a7.92,7.92,0,0,1,0,14.86l-55.09,20.3-20.3,55.09a7.92,7.92,0,0,1-14.86,0Z","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"176","y1":"16","x2":"176","y2":"64","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"224","y1":"72","x2":"224","y2":"104","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"152","y1":"40","x2":"200","y2":"40","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"208","y1":"88","x2":"240","y2":"88","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "squares-four": [
    ["rect", {"x":"48","y":"48","width":"64","height":"64","rx":"8","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["rect", {"x":"144","y":"48","width":"64","height":"64","rx":"8","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["rect", {"x":"48","y":"144","width":"64","height":"64","rx":"8","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["rect", {"x":"144","y":"144","width":"64","height":"64","rx":"8","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "stack": [
    ["polyline", {"points":"32 176 128 232 224 176","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"32 128 128 184 224 128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polygon", {"points":"32 80 128 136 224 80 128 24 32 80","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "storefront": [
    ["polyline", {"points":"48 139.59 48 216 208 216 208 139.59","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M54,40H202a8,8,0,0,1,7.69,5.8L224,96H32L46.34,45.8A8,8,0,0,1,54,40Z","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M96,96v16a32,32,0,0,1-64,0V96","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M160,96v16a32,32,0,0,1-64,0V96","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M224,96v16a32,32,0,0,1-64,0V96","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "sun": [
    ["line", {"x1":"128","y1":"40","x2":"128","y2":"16","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["circle", {"cx":"128","cy":"128","r":"56","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"64","y1":"64","x2":"48","y2":"48","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"64","y1":"192","x2":"48","y2":"208","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"192","y1":"64","x2":"208","y2":"48","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"192","y1":"192","x2":"208","y2":"208","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"40","y1":"128","x2":"16","y2":"128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"128","y1":"216","x2":"128","y2":"240","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"216","y1":"128","x2":"240","y2":"128","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "tag": [
    ["path", {"d":"M42.34,138.34A8,8,0,0,1,40,132.69V40h92.69a8,8,0,0,1,5.65,2.34l99.32,99.32a8,8,0,0,1,0,11.31L153,237.66a8,8,0,0,1-11.31,0Z","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["circle", {"cx":"84","cy":"84","r":"10"}],
  ],
  "trash-simple": [
    ["line", {"x1":"216","y1":"56","x2":"40","y2":"56","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"88","y1":"24","x2":"168","y2":"24","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M200,56V208a8,8,0,0,1-8,8H64a8,8,0,0,1-8-8V56","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "truck": [
    ["path", {"d":"M184,80h42.58A8,8,0,0,1,234,85l14,35","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"24","y1":"144","x2":"184","y2":"144","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["circle", {"cx":"192","cy":"192","r":"24","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["circle", {"cx":"80","cy":"192","r":"24","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"168","y1":"192","x2":"104","y2":"192","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M184,120h64v64a8,8,0,0,1-8,8H216","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["path", {"d":"M56,192H32a8,8,0,0,1-8-8V72a8,8,0,0,1,8-8H184V169.37","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "upload-simple": [
    ["line", {"x1":"128","y1":"144","x2":"128","y2":"32","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"216 144 216 208 40 208 40 144","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["polyline", {"points":"88 72 128 32 168 72","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "user-circle": [
    ["path", {"d":"M63.8,199.37a72,72,0,0,1,128.4,0","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["circle", {"cx":"128","cy":"128","r":"96","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["circle", {"cx":"128","cy":"120","r":"40","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
  "warning": [
    ["path", {"d":"M142.41,40.22l87.46,151.87C236,202.79,228.08,216,215.46,216H40.54C27.92,216,20,202.79,26.13,192.09L113.59,40.22C119.89,29.26,136.11,29.26,142.41,40.22Z","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"128","y1":"144","x2":"128","y2":"104","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["circle", {"cx":"128","cy":"180","r":"10"}],
  ],
  "warning-circle": [
    ["circle", {"cx":"128","cy":"128","r":"96","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"128","y1":"136","x2":"128","y2":"80","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["circle", {"cx":"128","cy":"172","r":"10"}],
  ],
  "x": [
    ["line", {"x1":"200","y1":"56","x2":"56","y2":"200","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
    ["line", {"x1":"200","y1":"200","x2":"56","y2":"56","fill":"none","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"12"}],
  ],
};

export const FILL: Record<string, Shape[]> = {
  "arrow-left": [
    ["path", {"d":"M224,128a8,8,0,0,1-8,8H120v64a8,8,0,0,1-13.66,5.66l-72-72a8,8,0,0,1,0-11.32l72-72A8,8,0,0,1,120,56v64h96A8,8,0,0,1,224,128Z"}],
  ],
  "arrow-right": [
    ["path", {"d":"M221.66,133.66l-72,72A8,8,0,0,1,136,200V136H40a8,8,0,0,1,0-16h96V56a8,8,0,0,1,13.66-5.66l72,72A8,8,0,0,1,221.66,133.66Z"}],
  ],
  "arrows-clockwise": [
    ["path", {"d":"M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1-5.66-13.66L180.65,72a79.48,79.48,0,0,0-54.72-22.09h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27,96,96,0,0,1,192,60.7l18.36-18.36A8,8,0,0,1,224,48ZM186.41,183.29A80,80,0,0,1,75.35,184l18.31-18.31A8,8,0,0,0,88,152H40a8,8,0,0,0-8,8v48a8,8,0,0,0,13.66,5.66L64,195.3a95.42,95.42,0,0,0,66,26.76h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z"}],
  ],
  "buildings": [
    ["path", {"d":"M239.73,208H224V96a16,16,0,0,0-16-16H164a4,4,0,0,0-4,4V208H144V32.41a16.43,16.43,0,0,0-6.16-13,16,16,0,0,0-18.72-.69L39.12,72A16,16,0,0,0,32,85.34V208H16.27A8.18,8.18,0,0,0,8,215.47,8,8,0,0,0,16,224H240a8,8,0,0,0,8-8.53A8.18,8.18,0,0,0,239.73,208ZM76,184a8,8,0,0,1-8.53,8A8.18,8.18,0,0,1,60,183.72V168.27A8.19,8.19,0,0,1,67.47,160,8,8,0,0,1,76,168Zm0-56a8,8,0,0,1-8.53,8A8.19,8.19,0,0,1,60,127.72V112.27A8.19,8.19,0,0,1,67.47,104,8,8,0,0,1,76,112Zm40,56a8,8,0,0,1-8.53,8,8.18,8.18,0,0,1-7.47-8.26V168.27a8.19,8.19,0,0,1,7.47-8.26,8,8,0,0,1,8.53,8Zm0-56a8,8,0,0,1-8.53,8,8.19,8.19,0,0,1-7.47-8.26V112.27a8.19,8.19,0,0,1,7.47-8.26,8,8,0,0,1,8.53,8Z"}],
  ],
  "caret-down": [
    ["path", {"d":"M215.39,92.94A8,8,0,0,0,208,88H48a8,8,0,0,0-5.66,13.66l80,80a8,8,0,0,0,11.32,0l80-80A8,8,0,0,0,215.39,92.94Z"}],
  ],
  "caret-left": [
    ["path", {"d":"M163.06,40.61a8,8,0,0,0-8.72,1.73l-80,80a8,8,0,0,0,0,11.32l80,80A8,8,0,0,0,168,208V48A8,8,0,0,0,163.06,40.61Z"}],
  ],
  "caret-right": [
    ["path", {"d":"M181.66,122.34l-80-80A8,8,0,0,0,88,48V208a8,8,0,0,0,13.66,5.66l80-80A8,8,0,0,0,181.66,122.34Z"}],
  ],
  "caret-up": [
    ["path", {"d":"M213.66,154.34l-80-80a8,8,0,0,0-11.32,0l-80,80A8,8,0,0,0,48,168H208a8,8,0,0,0,5.66-13.66Z"}],
  ],
  "chart-bar": [
    ["path", {"d":"M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1,0-16h8V136a8,8,0,0,1,8-8H72a8,8,0,0,1,8,8v64H96V88a8,8,0,0,1,8-8h32a8,8,0,0,1,8,8V200h16V40a8,8,0,0,1,8-8h40a8,8,0,0,1,8,8V200h8A8,8,0,0,1,232,208Z"}],
  ],
  "chart-line-up": [
    ["path", {"d":"M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM200,192H56a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v76.69l34.34-34.35a8,8,0,0,1,11.32,0L128,132.69,172.69,88H144a8,8,0,0,1,0-16h48a8,8,0,0,1,8,8v48a8,8,0,0,1-16,0V99.31l-50.34,50.35a8,8,0,0,1-11.32,0L104,131.31l-40,40V176H200a8,8,0,0,1,0,16Z"}],
  ],
  "check-circle": [
    ["path", {"d":"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z"}],
  ],
  "chef-hat": [
    ["path", {"d":"M240,112a56.06,56.06,0,0,0-56-56c-1.77,0-3.54.1-5.29.26a56,56,0,0,0-101.42,0C75.54,56.1,73.77,56,72,56A56,56,0,0,0,48,162.59V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V162.59A56.09,56.09,0,0,0,240,112Zm-87.76,30.06,8-32a8,8,0,0,1,15.52,3.88l-8,32A8,8,0,0,1,160,152a8.13,8.13,0,0,1-1.95-.24A8,8,0,0,1,152.24,142.06ZM120,112a8,8,0,0,1,16,0v32a8,8,0,0,1-16,0Zm-33.94-7.76a8,8,0,0,1,9.7,5.82l8,32a8,8,0,0,1-5.82,9.7,8.13,8.13,0,0,1-2,.24,8,8,0,0,1-7.75-6.06l-8-32A8,8,0,0,1,86.06,104.24ZM192,208H64V167.42a55.49,55.49,0,0,0,8,.58H184a55.49,55.49,0,0,0,8-.58Z"}],
  ],
  "clock": [
    ["path", {"d":"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm56,112H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48a8,8,0,0,1,0,16Z"}],
  ],
  "clock-counter-clockwise": [
    ["path", {"d":"M224,128A96,96,0,0,1,62.11,197.82a8,8,0,1,1,11-11.64A80,80,0,1,0,71.43,71.43C67.9,75,64.58,78.51,61.35,82L77.66,98.34A8,8,0,0,1,72,112H32a8,8,0,0,1-8-8V64a8,8,0,0,1,13.66-5.66L50,70.7c3.22-3.49,6.54-7,10.06-10.55A96,96,0,0,1,224,128ZM128,72a8,8,0,0,0-8,8v48a8,8,0,0,0,3.88,6.86l40,24a8,8,0,1,0,8.24-13.72L136,123.47V80A8,8,0,0,0,128,72Z"}],
  ],
  "copy": [
    ["path", {"d":"M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32Zm-8,128H176V88a8,8,0,0,0-8-8H96V48H208Z"}],
  ],
  "dots-three": [
    ["path", {"d":"M224,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V96A16,16,0,0,0,224,80ZM60,140a12,12,0,1,1,12-12A12,12,0,0,1,60,140Zm68,0a12,12,0,1,1,12-12A12,12,0,0,1,128,140Zm68,0a12,12,0,1,1,12-12A12,12,0,0,1,196,140Z"}],
  ],
  "envelope-simple": [
    ["path", {"d":"M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-8,144H40V74.19l82.59,75.71a8,8,0,0,0,10.82,0L216,74.19V192Z"}],
  ],
  "eye": [
    ["path", {"d":"M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z"}],
  ],
  "eye-closed": [
    ["path", {"d":"M230.94,164A8,8,0,1,1,217.05,172l-19-33.2A123.23,123.23,0,0,1,162,155.46l5.87,35.22a8,8,0,0,1-6.58,9.21A8.4,8.4,0,0,1,160,200a8,8,0,0,1-7.88-6.69l-5.77-34.58a133.06,133.06,0,0,1-36.68,0l-5.77,34.58A8,8,0,0,1,96,200a8.4,8.4,0,0,1-1.32-.11,8,8,0,0,1-6.58-9.21L94,155.46a123.23,123.23,0,0,1-36.06-16.69L39,172A8,8,0,1,1,25.06,164l20-35a152.8,152.8,0,0,1-19.3-20,8,8,0,0,1,0-10.06C44.56,75.72,77.55,48,128,48s83.44,27.72,102.22,51a8,8,0,0,1,0,10.06,152.8,152.8,0,0,1-19.3,20Z"}],
  ],
  "file-text": [
    ["path", {"d":"M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,176H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm-8-56V44l44,44Z"}],
  ],
  "flower-lotus": [
    ["path", {"d":"M245.83,121.63a15.53,15.53,0,0,0-9.52-7.33,73.55,73.55,0,0,0-22.17-2.22c4-19.85,1-35.55-2-44.86a16.17,16.17,0,0,0-18.8-10.88,85.53,85.53,0,0,0-28.55,12.12,94.58,94.58,0,0,0-27.11-33.25,16.05,16.05,0,0,0-19.26,0A94.58,94.58,0,0,0,91.26,68.46,85.53,85.53,0,0,0,62.71,56.34,16.14,16.14,0,0,0,43.92,67.22c-3,9.31-6,25-2.06,44.86a73.55,73.55,0,0,0-22.17,2.22,15.53,15.53,0,0,0-9.52,7.33,16,16,0,0,0-1.6,12.26c3.39,12.58,13.8,36.49,45.33,55.33S113.13,208,128.05,208s42.67,0,74-18.78c31.53-18.84,41.94-42.75,45.33-55.33A16,16,0,0,0,245.83,121.63ZM62.1,175.49C35.47,159.57,26.82,140.05,24,129.7a59.61,59.61,0,0,1,22.5-1.17,129.08,129.08,0,0,0,9.15,19.41,142.28,142.28,0,0,0,34,39.56A114.92,114.92,0,0,1,62.1,175.49ZM128,190.4c-9.33-6.94-32-28.23-32-71.23C96,76.7,118.38,55.24,128,48c9.62,7.26,32,28.72,32,71.19C160,162.17,137.33,183.46,128,190.4Zm104-60.68c-2.77,10.24-11.4,29.81-38.09,45.77a114.92,114.92,0,0,1-27.55,12,142.28,142.28,0,0,0,34-39.56,129.08,129.08,0,0,0,9.15-19.41A59.69,59.69,0,0,1,232,129.71Z"}],
  ],
  "fork-knife": [
    ["path", {"d":"M216,40V224a8,8,0,0,1-16,0V176H152a8,8,0,0,1-8-8,268.75,268.75,0,0,1,7.22-56.88c9.78-40.49,28.32-67.63,53.63-78.47A8,8,0,0,1,216,40Zm-96.11-1.31a8,8,0,1,0-15.78,2.63L111.89,88H88V40a8,8,0,0,0-16,0V88H48.11l7.78-46.68a8,8,0,1,0-15.78-2.63l-8,48A8.17,8.17,0,0,0,32,88a48.07,48.07,0,0,0,40,47.32V224a8,8,0,0,0,16,0V135.32A48.07,48.07,0,0,0,128,88a8.17,8.17,0,0,0-.11-1.31Z"}],
  ],
  "gear": [
    ["path", {"d":"M216,130.16q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.6,107.6,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.29,107.29,0,0,0-26.25-10.86,8,8,0,0,0-7.06,1.48L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.6,107.6,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z"}],
  ],
  "image": [
    ["path", {"d":"M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM156,88a12,12,0,1,1-12,12A12,12,0,0,1,156,88Zm60,112H40V160.69l46.34-46.35a8,8,0,0,1,11.32,0h0L165,181.66a8,8,0,0,0,11.32-11.32l-17.66-17.65L173,138.34a8,8,0,0,1,11.31,0L216,170.07V200Z"}],
  ],
  "info": [
    ["path", {"d":"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-4,48a12,12,0,1,1-12,12A12,12,0,0,1,124,72Zm12,112a16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40a8,8,0,0,1,0,16Z"}],
  ],
  "layout": [
    ["path", {"d":"M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM40,56H216V96H40ZM216,200H112V112H216v88Z"}],
  ],
  "list": [
    ["path", {"d":"M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM192,184H64a8,8,0,0,1,0-16H192a8,8,0,0,1,0,16Zm0-48H64a8,8,0,0,1,0-16H192a8,8,0,0,1,0,16Zm0-48H64a8,8,0,0,1,0-16H192a8,8,0,0,1,0,16Z"}],
  ],
  "list-checks": [
    ["path", {"d":"M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM117.66,149.66l-32,32a8,8,0,0,1-11.32,0l-16-16a8,8,0,0,1,11.32-11.32L80,164.69l26.34-26.35a8,8,0,0,1,11.32,11.32Zm0-64-32,32a8,8,0,0,1-11.32,0l-16-16A8,8,0,0,1,69.66,90.34L80,100.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM192,168H144a8,8,0,0,1,0-16h48a8,8,0,0,1,0,16Zm0-64H144a8,8,0,0,1,0-16h48a8,8,0,0,1,0,16Z"}],
  ],
  "lock": [
    ["path", {"d":"M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm-80,84a12,12,0,1,1,12-12A12,12,0,0,1,128,164Zm32-84H96V56a32,32,0,0,1,64,0Z"}],
  ],
  "magnifying-glass": [
    ["path", {"d":"M168,112a56,56,0,1,1-56-56A56,56,0,0,1,168,112Zm61.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88,88,0,1,1,11.32-11.31l50.06,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"}],
  ],
  "minus": [
    ["path", {"d":"M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM184,136H72a8,8,0,0,1,0-16H184a8,8,0,0,1,0,16Z"}],
  ],
  "moon": [
    ["path", {"d":"M235.54,150.21a104.84,104.84,0,0,1-37,52.91A104,104,0,0,1,32,120,103.09,103.09,0,0,1,52.88,57.48a104.84,104.84,0,0,1,52.91-37,8,8,0,0,1,10,10,88.08,88.08,0,0,0,109.8,109.8,8,8,0,0,1,10,10Z"}],
  ],
  "package": [
    ["path", {"d":"M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32l80.35,44L178.57,92.29l-80.35-44Zm0,88L47.65,76,81.56,57.43l80.35,44Zm88,55.85h0l-80,43.79V133.83l32-17.51V152a8,8,0,0,0,16,0V107.56l32-17.51v85.76Z"}],
  ],
  "pencil-simple": [
    ["path", {"d":"M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM192,108.68,147.31,64l24-24L216,84.68Z"}],
  ],
  "pill": [
    ["path", {"d":"M216.43,39.6a53.27,53.27,0,0,0-75.33,0L39.6,141.09a53.26,53.26,0,0,0,75.32,75.31L216.43,114.91A53.32,53.32,0,0,0,216.43,39.6Zm-11.32,64-50.75,50.74-52.69-52.68,50.75-50.75a37.26,37.26,0,0,1,52.69,52.69ZM189.68,82.34a8,8,0,0,1,0,11.32l-24,24a8,8,0,1,1-11.31-11.32l24-24A8,8,0,0,1,189.68,82.34Z"}],
  ],
  "plus": [
    ["path", {"d":"M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM184,136H136v48a8,8,0,0,1-16,0V136H72a8,8,0,0,1,0-16h48V72a8,8,0,0,1,16,0v48h48a8,8,0,0,1,0,16Z"}],
  ],
  "sidebar-simple": [
    ["path", {"d":"M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H88V56H216V200Z"}],
  ],
  "sign-out": [
    ["path", {"d":"M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40A8,8,0,0,0,176,88v32H112a8,8,0,0,0,0,16h64v32a8,8,0,0,0,13.66,5.66l40-40A8,8,0,0,0,229.66,122.34Z"}],
  ],
  "sparkle": [
    ["path", {"d":"M208,144a15.78,15.78,0,0,1-10.42,14.94L146,178l-19,51.62a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88L78,110l19-51.62a15.92,15.92,0,0,1,29.88,0L146,110l51.62,19A15.78,15.78,0,0,1,208,144ZM152,48h16V64a8,8,0,0,0,16,0V48h16a8,8,0,0,0,0-16H184V16a8,8,0,0,0-16,0V32H152a8,8,0,0,0,0,16Zm88,32h-8V72a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0V96h8a8,8,0,0,0,0-16Z"}],
  ],
  "squares-four": [
    ["path", {"d":"M120,56v48a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40h48A16,16,0,0,1,120,56Zm80-16H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm-96,96H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm96,0H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Z"}],
  ],
  "stack": [
    ["path", {"d":"M220,169.09l-92,53.65L36,169.09A8,8,0,0,0,28,182.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,169.09Z"}],
    ["path", {"d":"M220,121.09l-92,53.65L36,121.09A8,8,0,0,0,28,134.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,121.09Z"}],
    ["path", {"d":"M28,86.91l96,56a8,8,0,0,0,8.06,0l96-56a8,8,0,0,0,0-13.82l-96-56a8,8,0,0,0-8.06,0l-96,56a8,8,0,0,0,0,13.82Z"}],
  ],
  "storefront": [
    ["path", {"d":"M231.69,93.81,217.35,43.6A16.07,16.07,0,0,0,202,32H54A16.07,16.07,0,0,0,38.65,43.6L24.31,93.81A7.94,7.94,0,0,0,24,96v16a40,40,0,0,0,16,32v72a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V144a40,40,0,0,0,16-32V96A7.94,7.94,0,0,0,231.69,93.81ZM88,112a24,24,0,0,1-35.12,21.26,7.88,7.88,0,0,0-1.82-1.06A24,24,0,0,1,40,112v-8H88Zm64,0a24,24,0,0,1-48,0v-8h48Zm64,0a24,24,0,0,1-11.07,20.2,8.08,8.08,0,0,0-1.8,1.05A24,24,0,0,1,168,112v-8h48Z"}],
  ],
  "sun": [
    ["path", {"d":"M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm8,24a64,64,0,1,0,64,64A64.07,64.07,0,0,0,128,64ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"}],
  ],
  "tag": [
    ["path", {"d":"M243.31,136,144,36.69A15.86,15.86,0,0,0,132.69,32H40a8,8,0,0,0-8,8v92.69A15.86,15.86,0,0,0,36.69,144L136,243.31a16,16,0,0,0,22.63,0l84.68-84.68a16,16,0,0,0,0-22.63ZM84,96A12,12,0,1,1,96,84,12,12,0,0,1,84,96Z"}],
  ],
  "trash-simple": [
    ["path", {"d":"M224,56a8,8,0,0,1-8,8h-8V208a16,16,0,0,1-16,16H64a16,16,0,0,1-16-16V64H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,56ZM88,32h80a8,8,0,0,0,0-16H88a8,8,0,0,0,0,16Z"}],
  ],
  "truck": [
    ["path", {"d":"M255.43,117l-14-35A15.93,15.93,0,0,0,226.58,72H192V64a8,8,0,0,0-8-8H32A16,16,0,0,0,16,72V184a16,16,0,0,0,16,16H49a32,32,0,0,0,62,0h50a32,32,0,0,0,62,0h17a16,16,0,0,0,16-16V120A8.13,8.13,0,0,0,255.43,117ZM80,208a16,16,0,1,1,16-16A16,16,0,0,1,80,208ZM32,136V72H176v64Zm160,72a16,16,0,1,1,16-16A16,16,0,0,1,192,208Zm0-96V88h34.58l9.6,24Z"}],
  ],
  "upload-simple": [
    ["path", {"d":"M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM88,80h32v64a8,8,0,0,0,16,0V80h32a8,8,0,0,0,5.66-13.66l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,88,80Z"}],
  ],
  "user-circle": [
    ["path", {"d":"M172,120a44,44,0,1,1-44-44A44.05,44.05,0,0,1,172,120Zm60,8A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88.09,88.09,0,0,0-91.47-87.93C77.43,41.89,39.87,81.12,40,128.25a87.65,87.65,0,0,0,22.24,58.16A79.71,79.71,0,0,1,84,165.1a4,4,0,0,1,4.83.32,59.83,59.83,0,0,0,78.28,0,4,4,0,0,1,4.83-.32,79.71,79.71,0,0,1,21.79,21.31A87.62,87.62,0,0,0,216,128Z"}],
  ],
  "warning": [
    ["path", {"d":"M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"}],
  ],
  "warning-circle": [
    ["path", {"d":"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-8,56a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm8,104a12,12,0,1,1,12-12A12,12,0,0,1,128,184Z"}],
  ],
  "x": [
    ["path", {"d":"M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM181.66,170.34a8,8,0,0,1-11.32,11.32L128,139.31,85.66,181.66a8,8,0,0,1-11.32-11.32L116.69,128,74.34,85.66A8,8,0,0,1,85.66,74.34L128,116.69l42.34-42.35a8,8,0,0,1,11.32,11.32L139.31,128Z"}],
  ],
};
