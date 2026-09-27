# ColourSpace Profile Viewer

An independent browser-based tool for viewing and comparing display color-space measurement profiles.

## Run

Open `index.html` in a modern browser. Drag `.bcs` files or folders into the Files panel to compare measurements. No installation or network connection is required for normal use.

The app reads profile files locally in the browser. It does not upload imported BCS files. Exported HTML reports are self-contained and include the report data and viewer code; share them only with people who should receive that data.

## Features

- EOTF, RGB Balance, CIE, Volumetric, and Delta-E charts
- Target color-space and luminance settings
- Profile comparison, patch details, and notes
- Import/export of settings and complete data
- Self-contained, read-only HTML report export
- Built-in Demo 1 and Demo 2 profiles

## Project files

The current release is kept at the repository root. `build_report_runtime.mjs` refreshes the embedded runtime used when exporting standalone reports. Built-in demo profiles are shipped in `demo_profiles.js`, so the project has no dependency on a local BCS folder.

Personal BCS measurements, exported reports, backups, archived releases, and work-in-progress files are intentionally excluded from the GitHub release. The local `.gitignore` keeps those private folders out of commits.

## Checks

```sh
npm test
npm run build:report-runtime
```

The project has no runtime package dependencies; the report builder uses Node.js built-in modules only.

## Credits

This independent project was inspired by Light Illusion's ColourSpace and Rational Acoustics' Smaart. It is not affiliated with, endorsed by, or sponsored by either company. All trademarks are the property of their respective owners and are used only to identify their products.

## License

Copyright © 2026 WhARTS Ltd. All rights reserved. See [LICENSE](LICENSE) for the permitted-use terms. This is source-available software, not an open-source release.
