# 𝄆 Etude 𝄇

**Tools for practicing musicians.** A small suite of private, offline, browser-based tools. No accounts, no tracking; everything runs right in your browser.

> *étude*: a piece written to practice a skill. That's the whole idea.

**▶ Live:** https://onurcelep.github.io/etude/

## Tools

### Looper · [`/looper/`](https://onurcelep.github.io/etude/looper/)

Open a local video or audio file, loop a passage, slow it down, and change the key. Nothing is uploaded; your files never leave your device.

- **Loop sections (A–B):** mark a start and end, drag the markers, save named loops and switch between them.
- **Transpose & pitch:** shift by semitones (and fine cents) independently of speed.
- **Speed:** 25%–200% with "keep pitch" (time-stretch), plus an optional song-BPM readout.
- **Audio or video:** the file's audio is decoded and played through [Signalsmith Stretch](https://github.com/Signalsmith-Audio/signalsmith-stretch), so transpose and slow-down work together smoothly; the video follows, muted.
- **Sessions:** save a file with its loops and settings, then reopen it instantly (stored locally via IndexedDB).
- **Light / dark**, **English / Türkçe / Deutsch** (auto-detected), and an **installable PWA** that works offline.

### Coming soon

A metronome and a tuner.

## Structure

```
/                  the Etude hub (landing page)
/looper/           the Looper tool
/shared/theme.css  shared light/dark design tokens
```

Every tool is a self-contained static page (HTML, CSS, JS; no build step). New tools link `shared/theme.css` so the suite stays visually consistent. Deployed to GitHub Pages via a small Actions workflow.

## Install (optional)

On desktop, use your browser's *Install* option; on mobile, *Share → Add to Home Screen*. It then works fully offline.

## License

MIT (see [LICENSE](LICENSE)). The Looper bundles **Signalsmith Stretch**, which is also MIT-licensed.

## Support

If Etude helps your practice, you can [buy me a coffee ☕](https://buymeacoffee.com/onurcelep).
