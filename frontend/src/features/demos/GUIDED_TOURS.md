# Guided tour contract

The shared demo page owns the entry button, subtitles, chapter progress, playback, navigation and exit. A tour is opt-in: demos without `guide` in `registry.ts` keep their existing UI.

## Add a tour

1. Declare `guide: { titleKey, steps: [{ id, subtitleKey, durationMs }] }` in the demo's registry entry. Cue ids must be unique; durations must be positive and long enough to read in both locales. Add every key to the locale bundles. The registry test checks keys, order and uniqueness for the eclipse tour.
2. Implement `beginGuide`, `seekGuide(cueId, progress)` and `endGuide` in the scene. `beginGuide` snapshots the user's event, simulated time, view, toggles, playback and camera. `seekGuide` must work in any order, with progress from 0 to 1, without relying on a previous cue having run. `endGuide` restores the snapshot, including playback. Do not change the shared `DemoSceneSettings` shape for tour-specific values.
3. If a scene has a custom control panel, accept the optional `guided` prop: keep the visual scene visible, but hide its normal controls and explanatory notes while the subtitle overlay is active. Other scene content can remain behind the overlay.
4. Keep each subtitle tied to what its cue actually depicts. Distinguish physical calculations from schematic scales or borrowed imagery. Cite sources in the demo's ordinary copy and include safety instructions where needed. An accessible label names each chapter button; the generic player honors reduced-motion preference by opening paused.
5. Tie visual emphasis to `seekGuide` progress, not elapsed wall time: pausing and jumping must freeze or reconstruct every effect. A diagram may brighten a real target and an observer view may outline a calculated fraction; emphasis must never change the physical geometry or imply a measurement that was not computed.
6. When adjacent cues show consecutive phases of one event, make the first cue's final simulated instant exactly the next cue's first instant. Refine approximate contact predictions against the scene's live classification before seeking; never jump to the middle of a long total phase at a chapter boundary.
7. Historical photographs may illustrate appearance, but must be labelled with their actual date, creator, licence and the fact that they are not the selected event. Blend sampled frames by a measured phase or coverage, and leave the calculated geometry in charge of the main simulation.

## Review checklist

- Enter from a running and a paused scene; exit by button and Escape. In both cases verify the original event, time, section/view, observer position, toggles, camera and playback return.
- Play through, pause/resume, jump forward/backward, click chapter progress and replay at the end. Verify no cue depends on the previous one or runs past its phase boundaries.
- Compare both sides of every adjacent observer-view chapter boundary: the clock, classification and photographed reference should not flash or jump forward.
- Check both languages, mobile/desktop sizes, fullscreen, hidden-tab return and reduced-motion preference. Subtitle and buttons must not cover the key visual, and keyboard focus must remain usable.
- Run `yarn typecheck`, `yarn test:run` and `yarn build`. Add a scene-specific cue/window test when a guide scrubs simulation time.
