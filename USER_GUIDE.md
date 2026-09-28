# ColourSpace Profile Viewer — User Guide

ColourSpace Profile Viewer is a browser-based companion for reviewing and presenting ColourSpace `.bcs` profiles. Its main purpose is to make it easy to compare several profiles side by side or overlay them on shared charts. It is a viewing and comparison tool, not a display-calibration system.

## Getting started

Open the online version, or open `index.html` from a downloaded copy. For the quickest first look, use the built-in **Demo 1** and **Demo 2** profiles; no files need to be imported.

To load your own measurements, drag `.bcs` files or a folder containing them into the **Files** panel. You can also drop files into that panel. Folder names are retained in the list to make imported sets easier to browse. Files with the same name can be imported when they come from different paths; importing the same path again is prevented.

Imported measurements are processed in the browser and are not uploaded by the viewer.

## The workspace

- **Files** contains built-in colour spaces and profiles, imported profiles, and the built-in demos. Expand or collapse category and folder headings to navigate larger collections.
- **Charts** show the selected measurements. Each chart has its own profile selection and view settings.
- **Profile** panels show details for up to two assigned profiles. Drag a profile onto a panel to assign it; drag one Profile panel onto the other to swap them.
- **Target** defines the reference used by target-dependent chart overlays and comparisons.
- **Patch / Note** shows details for the point under the pointer, or a note for the workspace. In exported reports this area is fixed to **Note**.

The panel dividers can be dragged to adjust the Files and Profile areas. Drag the divider between the two Profile panels to change their relative heights. Target can be collapsed from its `…` menu; the same menu also resets Target settings.

## Working with profiles

### Add profiles to charts

Drag a measured profile from **Files** onto a chart to add it to that chart. The same profile may be added to more than one chart. Drag a profile from Files onto a Profile panel to show its summary there.

Click a profile's small circle in Files to hide or restore that profile across charts. This visibility control is separate from chart assignment: hiding a profile does not remove it from charts. Hovering a profile previews its data; hovering a chart point highlights the corresponding profile across charts and displays its patch details.

### Select, remove, and recolour files

- Click a file to select it.
- **Command-click** on macOS, or **Control-click** on Windows/Linux, to add or remove an item from the selection.
- **Shift-click** to select a range.
- Drag across an empty area of the Files list to marquee-select multiple profiles. Hold Command/Control to add to the existing selection.
- Press **Delete** or **Backspace** to unload the selected imported profiles. Built-in items are not removed this way.

Right-click a single profile and choose **Set color** or **Assign random color** to recolour it. With multiple imported profiles selected, use the same actions to assign one chosen colour to all selected profiles, or a separately generated random colour to each. The colour picker includes **Apply** and **Cancel**; cancelling leaves the existing colours unchanged. Files has its own `…` menu for **Unload all files**.

## Chart controls

The `…` menu on each chart changes that chart's type, swaps the chart with another panel by dragging its menu button, and provides chart-specific actions. Available chart types are **CIE**, **Volumetric**, **EOTF**, **RGB Balance**, and **Delta-E**.

Use the chart's inline controls to change its view:

- **CIE:** switch between `xy` and `u′v′`; switch between **All points** and **Gamut only**.
- **Volumetric:** switch between `xyY` and `uvY`; switch between **All points** and **Gamut only**.
- **EOTF:** switch between relative and absolute presentation.
- **RGB Balance:** switch between normalized and absolute presentation.
- **Delta-E:** switch between grayscale and distribution presentation.

The chart menu also controls whether the chart uses multi-colour profile colours or a single colour, restores hidden profiles to the chart, clears that chart's profile assignments, and offers chart layout options. The layout chooser selects which chart appears in the bottom-right position; unused positions can be left empty. **All points / Gamut only** changes the amount of plotted measurement detail where available.

Right-click a chart area for **All charts** actions. These apply across chart panels: set all charts to mono or multi colour, show all hidden profiles, or clear all chart assignments. Right-click a Profile panel for **All profiles** actions to clear both profile panels. The temporary outline indicates which area the action will affect.

### Navigate the Volumetric chart

- Drag with the left mouse button to rotate the view.
- Hold **Command** (macOS) or **Control** (Windows/Linux) while dragging with the left mouse button to pan.
- Use the scroll wheel to zoom. The zoom range is 0.7× to 100×.
- Hold **Option** (macOS) or **Alt** (Windows/Linux) while dragging with the left mouse button over a measurement point to rotate around that point.
- Hover a point to inspect its patch. Hovering a point also highlights its profile in other charts when that profile is shown there.

## Target and measured references

Target settings include gamut, white point, EOTF/gamma, and luminance range. Choose built-in presets or edit the available coordinates and values directly. Selecting **Measured** for a supported target value uses the selected measurement reference; the `…` menu can reset Target to the values saved with the workspace or report.

Drag a measured profile from Files onto Target to choose which of its measured values to use. The import dialog lets you select which available values to apply (gamut, white point, EOTF, and luminance limits); unavailable values cannot be selected. Dragging a built-in colour space onto Target, or double-clicking it, applies that preset.

The title-bar date and author are optional. Double-click the text to edit; save or cancel the edit. Clicking elsewhere, opening another control, or invoking another action cancels the edit.

## Patch details and notes

Hover over a plotted measurement to show its patch information in the lower-right panel. The panel's `…` menu switches between **Patch** and **Note**, and includes **Clear note**. A note is editable in the workspace; selecting text reveals a compact formatting toolbar. Basic emphasis, underline, strikethrough, and text colour are available. Pasted content is sanitized to remove unsupported or active elements.

Target reference markers (including RGBWCMY where applicable) are displayed separately from measured profile points. Patch details identify the target/reference RGB values as well as measured values when available.

## Save, import, and export

Open the gear menu to access **Import**, **Export**, **Clear data**, **Reset workspace**, and **About**.

**Import** can load workspace settings or complete viewer data. Settings restore the target, chart and layout choices, panel state, and other workspace preferences without replacing the current imported profile data. Complete viewer data restores the included profiles and workspace content.

**Export** lets you choose one or more formats:

- **Settings (.json):** workspace configuration, without the measurement files.
- **Complete data (.json):** the profile data together with workspace settings, for later import into the viewer.
- **External report (.html):** a self-contained interactive report that can be opened or shared as one HTML file.

Exported filenames use the optional date and author when present. A report includes the profiles currently loaded for the report and the relevant workspace presentation settings. Check the recipient and contents before sharing measurement data.

In an external report, readers can change chart presentation, hide profiles, and restore hidden profiles. They cannot import more profiles, drag profiles between charts or Profile panels, recolour profiles, edit notes, or change the report's saved Target values; **Reset Target** returns to the values captured at export.

## Practical notes

- The viewer does not alter the source `.bcs` files.
- Colour and spectral backgrounds are on-screen visual references; display appearance depends on the viewer's own screen and browser.
- A self-contained HTML report includes its data and viewer code. Anyone who receives it can inspect the file contents, so treat it like the measurement data it contains.
- If opening `index.html` directly causes browser restrictions, run a local web server from the project folder and open the local address in your browser.
