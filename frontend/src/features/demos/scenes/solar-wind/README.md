# Solar wind and auroras

Entry: `/demos/solar-wind`. The registry lazy-loads a Vue control panel and a
Three.js `DemoScene`; no new shared scene settings or dependencies are required.
The pre-existing positional-astronomy work remains independent.

## Teaching model

`model.ts` separates a normalized pressure proxy from an IMF-direction coupling
proxy. Quiet and strong presets both use northward IMF. Strong and reconnection
presets both use strength 85, so the final comparison changes only direction.
Nonzero northward coupling avoids teaching that northward IMF prohibits all
reconnection or auroras. Strength is not speed, density, Kp, or a measured unit.

The nose, tail, oval width and colatitude are bounded visual mappings, not fitted
physical laws. The tail-length control illustrates deformation and stored energy;
real tail dynamics are not determined by this expression. Instant changes omit
propagation, storage and release delays. A sideways arrow is a categorical key
for near-zero north–south component, not a full 3D IMF vector.

Field arcs terminate at high-latitude footpoints. Wind particles deflect around
the boundary; a separate magnetospheric population illustrates precipitation.
The reconnection marker shows relative favorability, not a simulated topology
change or a measured rate. The two emission layers illustrate composition and
altitude; their colors are not an intensity thermometer. Sizes, distances,
altitudes and trajectories are schematic. Symmetric magnetic poles omit tilt,
hemisphere asymmetry and day–night differences. This cannot forecast visibility.

Manual guide steps load deterministic presets and remain readable while motion
is paused. Native range/select/buttons work with the keyboard. The panel stops
key propagation so the shell's Space shortcut cannot swallow button activation.
Drag to orbit and wheel/pinch to zoom. Camera buttons provide equivalent input;
with the canvas focused, arrows orbit, +/− zoom, and Home resets the selected view.
Overview and aurora close-up are camera presets independent of physical state.
Changing physical parameters preserves the camera. OrbitControls has no damping
or automatic rotation, allowing direct manipulation while animation is paused.
Reduced-motion preference stops animation but still renders input and resize
changes. Hidden pages and WebGL context loss stop rendering. Initialization
failure uses the shared WebGL notice plus disabled controls and readable sources.

## Rendering and ownership

240 preallocated solar-wind positions, one batched trail draw call, 32
precipitation positions and 180 static background stars; capped DPR 1.5, no
remote textures, shadows or postprocessing. The Earth reuses the repository's
NASA Blue Marble texture (`public/demos/meteor-shower/earth-day.jpg`); see
`THIRD_PARTY_NOTICES.md`. Sun granulation, halos, atmosphere and two aurora
curtains use procedural shaders. Curtain animation updates one uniform rather
than rebuilding geometry. The translucent magnetosphere and field arcs have
depth around the Sun–Earth axis, so orbiting does not reveal a flat drawing.
Geometry attributes are updated in place. `Stage.dispose()` owns all attached
geometry, materials, renderer, controls and its resize/RAF lifecycle; the scene
removes its own resize observer, media-query/context/keyboard listeners and frame
handler. The texture owner handles late image callbacks after disposal and a
blue material fallback on load failure. Labels are reprojected after camera,
physical-state or viewport changes.

## Verification

Run from `frontend`: `yarn typecheck`, `yarn test:run`, `yarn build`.
Scene tests use real Three.js geometry with a mocked stage, following existing
test conventions. They cover geometry responses, finite attributes, buffer reuse,
both poles, pause/reduced motion, context loss, suspension, camera manipulation,
zoom bounds, view presets, image failure/late completion and disposal. Pure
tests cover bounded mappings, north/south comparisons, presets, guide steps and
malformed commands. Vue DOM tests cover translations, native inputs, state
feedback, keyboard propagation and unavailable-WebGL controls.

Browser review: Chinese/English; desktop and 390×844; keyboard preset activation,
slider arrows and select changes; compare strength 85 across north/south; step
navigation; paused drag/wheel camera input; route away and back. Context loss and reduced motion are covered by
automated lifecycle tests rather than a physical GPU failure test.

## Sources

- [NASA: What Is the Solar Wind?](https://science.nasa.gov/sun/what-is-the-solar-wind/)
- [NASA: Auroras](https://science.nasa.gov/sun/auroras/)
- [NASA: The Magnetopause](https://pwg.gsfc.nasa.gov/Education/wmpause.html)
- [NASA: Mapping Earth's Magnetotail](https://science.nasa.gov/heliophysics/focus-areas/recent-research/mapping-magnetotail/)

These sources inform the qualitative explanation, not the numerical mapping.
