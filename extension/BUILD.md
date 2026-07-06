# Building the Etude extension from source

Every file in this package except two is plain, hand-written vanilla JavaScript, CSS,
JSON, or PNG, with no build step, no bundler, no minifier, and no template engine.

## The two derived files

1. **signalsmith-stretch.mjs** is a vendored, unmodified release of Signalsmith Stretch
   (MIT license), the WASM time-stretch and pitch-shift audio engine, from
   https://github.com/Signalsmith-Audio/signalsmith-stretch . It is included as-is and
   is not built or modified in this project.

2. **signalsmith-worklet.js** is generated from signalsmith-stretch.mjs by the included
   Node script gen-worklet.mjs. It extracts the AudioWorklet processor into a standalone
   file so it can be loaded from an extension URL, which is required because some sites'
   page CSP blocks `blob:` worklet URLs.

## Requirements (build environment)

- Any operating system with a POSIX shell: macOS, Linux, or Windows via WSL.
- Node.js 18 or newer, installed from https://nodejs.org . No npm packages are needed:
  the project has zero dependencies, so there is no `npm install` step.
- The `zip` command line utility (preinstalled on macOS and most Linux distributions).

## Reproduce the submitted add-on

From this folder, run these two steps in order:

```
node gen-worklet.mjs   # writes signalsmith-worklet.js from signalsmith-stretch.mjs
sh pack.sh             # writes dist/etude-chrome-<version>.zip and dist/etude-firefox-<version>.zip
```

`pack.sh` produces one zip per browser. The only differences from this source are in the
manifest `background` key (Chrome uses `service_worker`, Firefox uses `scripts`) and that
the Chrome build drops the Firefox-only `browser_specific_settings.gecko` block. Every
other file is byte-identical to this source.

The `dist/etude-firefox-<version>.zip` produced by these two commands is exactly the
submitted add-on. Node is the only tool used, and only for the two steps above.
