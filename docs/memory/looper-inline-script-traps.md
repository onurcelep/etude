# Looper inline-script traps

The Looper is one ~1500-line inline `<script>` sharing a single scope, with
several terse single-letter globals. Two traps this has already caused:

- **`t` is the i18n lookup helper.** Never name a local `t` in any function
  that also renders localized text. In `tick()`, `const t = pTime()` shadowed
  it; when the video-stall warning fired, `t('video_warn_body')` threw
  `t is not a function` and killed the requestAnimationFrame chain — frozen
  playhead/time and dead A-B looping until reload, with no visible error.
  The local there is now `tNow`. Other one-letter globals to watch: `v` (the
  video element), `$` (getElementById), `A`/`B` (loop points).

- **A crash anywhere in `tick()` silently stops the transport UI.** `tick()`
  self-reschedules via `requestAnimationFrame` at its end, so any uncaught
  throw inside it permanently stops the playhead, time display, loop jumps,
  and video resync while audio keeps playing. If a symptom is "indicator
  frozen but playback continues", check the console for one uncaught error
  first — the loop dies on the first throw.

Related: the frame-stall "can't decode" heuristic in `tick()` must not treat
seek stalls as decode failure — `seeking` restarts its watch, because every
A-B loop jump issues a seek.

## Audio capture / autoplay traps (Firefox-family, incl. Zen)

- `AudioContext.resume()` refused for lack of user activation does NOT
  reject in Firefox — the promise stays pending until the next gesture.
  Never bare-await it outside a click handler; race it with a timeout and
  check `ac.state` after.
- Transient user activation from the file picker expires within seconds.
  Slow decode attempts on a big file exhaust it, so anything downstream
  needing a running context (the capture pass) must verify the state,
  not assume the gesture still covers it.
- `createMediaElementSource(v)` permanently reroutes the element's audio
  into the graph. Any code path that creates it and then abandons the
  graph must reconnect it (to the gain node), or native playback goes
  silent with no error.
- While `preparing` is true the transport swallows play/pause taps — any
  state that can persist indefinitely under `preparing` is unrecoverable
  by the user. Guard every await in the prepare chain.
