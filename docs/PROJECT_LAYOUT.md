# Project layout

- Root JavaScript and HTML files: the current application source
- `tests/`: regression tests for the current release
- `local-data/profiles/`: local BCS measurement profiles, grouped by display or purpose
- `local-data/exports/`: generated reports and exported viewer data
- `local-data/backups/`: local backups of application files
- `local-data/work-in-progress/`: unpublished working copies
- `history/`: version history and older release snapshots
- `.github/`: repository automation

`local-data/` and `history/` are intentionally ignored by Git. They contain personal measurement data and historical working copies, not distributable application source.
