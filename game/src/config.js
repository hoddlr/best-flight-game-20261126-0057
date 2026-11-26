// Every tuning number for Sky Courier, the little prop-plane delivery game.
// The world is a fixed 1280x720 logical field; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** Fixed simulation step, in seconds: 60 updates a second, any display rate. */
export const STEP = 1 / 60;

/** localStorage key for the best score. */
export const BEST_KEY = 'sky-courier-best';

/** Length of the valley, in world pixels. The plane starts near x = 200. */
export const WORLD_LENGTH = 9600;

/** World x of each airstrip's runway centre, in order along the valley. */
export const STRIPS = [
  { name: 'Home Field', x: 420 },
  { name: 'Riverbend', x: 3200 },
  { name: 'Mill Town', x: 5900 },
  { name: 'High Pass', x: 8800 },
];

export const PLANE = {
  /** Cruise speed the prop settles toward at full throttle, px/s. */
  cruiseSpeed: 250,
  /** Top speed before the airframe complains, px/s. */
  maxSpeed: 380,
  /** Below this speed the wing gives up and the nose drops. */
  stallSpeed: 95,
  /** How hard pitch pulls the nose, radians per second at full stick. */
  pitchRate: 1.5,
  /** Throttle changes this fast, per second. */
  throttleRate: 0.9,
  /** Lift at cruise, tuned so level flight holds altitude. */
  lift: 0.9,
  /** Drag grows with the square of speed. */
  drag: 0.00045,
  /** Gravity pulling the nose down when stalled, px/s^2. */
  gravity: 260,
  /** Fuel tank, in seconds of full-throttle flight. */
  fuelMax: 100,
  /** Fuel burn per second at full throttle. */
  fuelBurn: 1.0,
  /** Fuel given back when a contract delivery lands. */
  fuelBonus: 34,
  /** Damage taken on a hard landing, per 100 px/s of excess sink. */
  hardLandingDamage: 26,
  /** Damage taken per second while scraping terrain. */
  scrapeDamage: 55,
};

export const RING = {
  /** Points for flying clean through one ring. */
  points: 50,
  /** Ring radius, in pixels. */
  radius: 46,
  /** Rings on the route between each pair of neighbouring strips. */
  perLeg: 4,
};

export const SCORE = {
  ring: 50,
  softLanding: 120,
  delivery: 300,
  perfectLandingBonus: 80,
  /** Sink rate (px/s) below which a landing counts as soft. */
  softSink: 60,
  /** Sink rate (px/s) above which a landing hurts. */
  hardSink: 150,
};

export const COLOURS = {
  skyTop: '#7fb8e8',
  skyMid: '#a8d0ef',
  skyLow: '#f2d8a0',
  sun: '#fff3c4',
  farMountain: '#8fa8c8',
  nearMountain: '#6d8a6d',
  hill: '#7fae62',
  field: '#a8c46a',
  fieldAlt: '#8fb45a',
  river: '#5fa8d8',
  road: '#8a7a5a',
  townRoof: '#c65a4a',
  townWall: '#f0e0c0',
  runway: '#5a5a5e',
  runwayMark: '#f5f5e8',
  planeBody: '#e84a3a',
  planeWing: '#f5f0e0',
  planeTrim: '#2a4a7a',
  hudPanel: 'rgba(12, 24, 40, 0.72)',
  hudText: '#e8f4ff',
  hudWarn: '#ffb347',
  hudBad: '#ff6a5a',
  ringGold: '#ffd94a',
};
