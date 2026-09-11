/** Mean lunar radius, the unit the whole scene is measured in. */
export const MOON_RADIUS_KM = 1737.4

/** Kilometres to scene units: the Moon is a sphere of radius one. */
export function kilometresToRadii(kilometres: number): number {
  return kilometres / MOON_RADIUS_KM
}

export const SCENE = {
  radius: 1,
  cameraFieldOfViewDeg: 40,
  /** Where the overview camera sits: just north of the sub-Earth point, looking at the near side. */
  homeLatDeg: 12,
  homeLonDeg: 0,
  homeDistance: 3.05,
  introDistance: 8.6,
  introSeconds: 4.4,
  focusSeconds: 1.9,
  /** LOLA height is doubled: still restrained at globe scale, but readable in oblique site views. */
  terrainExaggeration: 2,
  terrainWidthSegments: 512,
  terrainHeightSegments: 256,
  wideTerrainSegments: 128,
  fineTerrainSegments: 192,
  nacTerrainSegments: 96,
  maxPixelRatio: 1.5,
  colourAnisotropy: 4,
  heightAnisotropy: 2,
  /** Small gap above the terrain used by the focused camera's collision clamp. */
  terrainClearanceKm: 0.01,
  /**
   * The camera's near plane has to sit far closer than the stage default: at the lowest
   * allowed altitude the surface is only a few tens of metres away, and a near plane of 0.1
   * would simply clip the ground away. This is the ceiling the scene pulls it in from.
   */
  cameraNear: 0.002,
  /** Deepest the near plane is ever pulled in, in radii — about a metre and a half. */
  cameraNearMinimum: 1e-6,
  cameraFar: 2000,
  minCameraDistance: 1.03,
  maxCameraDistance: 14,

  /**
   * How far the camera may zoom in, expressed as screen pixels per texel of the surface map.
   * Past roughly this magnification the surface stops reading as terrain — see
   * `minimumAltitudeKm`.
   */
  maxScreenPixelsPerTexel: 3,
  /**
   * The same limit once a hotspot crop is on screen. A crop carries ten times the detail of the
   * atlas, so it can be stretched further and still beat the atlas's native resolution — which is
   * what gives a drill-down a useful zoom range instead of a token one.
   */
  maxScreenPixelsPerTexelDetail: 8,
  /**
   * The same limit again for the NAC tiers, which are the closest view a landing site has. It is
   * tighter than the WAC crops get: eight screen pixels per texel is fine for a shaded relief
   * seen from a hundred kilometres up, but at a hundred metres the same stretch turns a NAC
   * mosaic into mush. At four the ground still reads as terrain all the way down.
   */
  maxScreenPixelsPerTexelNac: 4,
  /**
   * Never let the camera get closer than this, whatever the imagery claims to support. It is a
   * backstop rather than a limit: every crop's own floor is well above it, from about 70 m over
   * the NAC close-ups to roughly 480 km over the globe.
   */
  minimumAltitudeKm: 0.05,

  /**
   * High-resolution patches for the focused feature sit just above the atlas. Their edges are
   * feathered, so they can stay this close without z-fighting — and the gap has to stay in the
   * tens of metres, because the camera now descends to about a hundred metres over the NAC
   * close-ups, where a patch floating higher than that would be behind the camera.
   */
  siteRadiusFactor: 1.00001,
  /** How far out a focused view may be pulled, in radii above the surface. */
  focusMaxAltitudeRadii: 1.2,
  /** Initial off-nadir angle: enough to expose displaced crater walls without starting at a graze. */
  focusArrivalTiltDeg: 22,
  /** Local-ground orbit limits: 0 is straight down and 90 degrees is on the horizon. */
  focusMinPolarAngle: 12 * Math.PI / 180,
  focusMaxPolarAngle: 78 * Math.PI / 180,
  overviewRotateSpeed: 0.72,
  focusDragRadiansPerPixelMin: 0.0018,
  focusDragRadiansPerPixelMax: 0.0042,
  focusedWheelScale: 0.0016,
  focusedKeyboardStepDeg: 3,
  labelUpdateIntervalSeconds: 1 / 30,
  /**
   * Fraction of a crop that must stay inside the screen for its feathered border to remain out
   * of sight, and the safety margin on top of that. The framing works backwards from these to
   * pick the altitude it flies to.
   */
  siteCoverage: 0.8,
  siteCoverMargin: 1.15,
  /** Crop-to-view ratios between which the patch fades in and out. */
  siteFadeIn: 1.3,
  siteFadeFull: 1.7,
  /**
   * Crop-to-view ratio at which a deeper tier starts downloading. It sits below `siteFadeIn` so
   * the texture is already on the mesh by the time its crop starts to fade in: the NAC tiers are
   * megabytes each, so they are fetched as the camera closes in rather than on arrival.
   */
  sitePreloadRatio: 0.7,

  graticuleStepDeg: 30,
  graticuleRadius: 1.0122,
  graticuleOpacity: 0.24,

  markerRadiusFactor: 1.0128,
  /** Sphere radius the markers are built with; their on-screen size is set per frame. */
  markerSize: 0.0062,
  /** Target on-screen diameter of a marker, in pixels. */
  markerPixels: 5,
  markerFocusPixels: 14,
  markerOpacity: 0.85,
  /** A click within this many degrees of a feature counts as clicking that feature. */
  pickRadiusDeg: 7,

  labelLimit: 8,
  labelSeparationPx: 96,
  /** Minimum cosine between a feature's normal and the view direction for it to be labelled. */
  labelFacingThreshold: 0.12,

  /** Simulated time is advanced in days per second of wall clock. */
  defaultTimeScale: 0.1,
} as const

/**
 * The scene's lighting. The Sun is the only bright source; the ambient and the earthshine term
 * keep the lunar night from turning into a featureless silhouette, which is what the real Earth
 * does to the Moon as well.
 */
export const LIGHTING = {
  sunIntensity: 2.4,
  ambientColor: 0x2b3f5e,
  ambientIntensity: 0.28,
  earthshineIntensity: 0.12,
  /** Full-bright has no terminator, but keeps a weak directional term so bump detail survives. */
  fullBrightAmbientColor: 0xffffff,
  fullBrightAmbientIntensity: 1.05,
  fullBrightSunIntensity: 0.3,
} as const
