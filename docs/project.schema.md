# project.json (version 1)

A project is one directory under `~/src/ops/creative/projects/`, laid out like a Camtasia
standalone package (plan: `creative/plans/2026-10-10_app-frame.md`):

```
projects/<name>/
├── project.json     this document
├── media/           the Media Bin: files copied in on import (or linked, see `linked`)
├── shots/           vidfx shot files and their Animation Scripts
├── work/            derived (keyframes, motion, crops, stills) — not in git
└── renders/         output — not in git
```

```json
{
  "version": 1,
  "name": "laptop-demo",                       // = the directory name; [A-Za-z0-9][\w.-]{0,63}
  "created": "2026-10-10T18:02:00.000Z",
  "modified": "2026-10-10T18:40:12.000Z",      // bumped by every Save
  "canvas": { "width": 1920, "height": 1080, "fps": 25 },
  "media": [
    { "id": "laptop", "file": "media/laptop.svg", "type": "image/svg+xml", "width": 1600, "height": 1000,
      "added": "2026-10-10T18:05:00.000Z", "source": "/Users/rick/Desktop/laptop.svg" },
    { "id": "frustration", "file": "/Users/rick/Desktop/frustration.mov", "type": "video/quicktime", "linked": true,
      "width": 3840, "height": 2160, "fps": 25, "duration": 19.64, "added": "…", "source": "/Users/rick/Desktop/frustration.mov" }
  ],
  "shots": [ "frustration-walk2" ],            // names of shots/<name>.yaml
  "recent": { "shot": "frustration-walk2", "view": "frames" }
}
```

## Rules

- `media[].file` is relative to the project directory for copied items; `linked: true` items keep an
  absolute path and show a chain badge. A file that is gone shows as "missing", never breaks the project.
- `shots[]` lists shot files the page knows about; the shot YAML stays the truth for the composite
  (`ui: ../media/<file>` references the bin).
- The bridge (`vite.config.ts`) creates projects (`POST /projects`), lists them (`GET /projects`) and
  serves `/projects/<name>/**`; only `project.json`, `work/**/anchors.json` and
  `shots/*.animation.md` are writable.
- Without `?project=` the page uses the legacy `video-fx/{work,shots,renders}` mounts.
