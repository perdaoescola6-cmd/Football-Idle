import type { State } from "./engine.js";
export type TestSpeed = 1 | 10 | 60;
export function gameTime(state: State, realNow: number): number {
  const clock = state.runtime.testClock;
  return clock
    ? Math.floor(clock.gameAnchor + (realNow - clock.realAnchor) * clock.speed)
    : realNow;
}
export function changeTestSpeed(
  state: State,
  speed: TestSpeed,
  realNow: number,
) {
  const now = gameTime(state, realNow);
  state.runtime.testClock = {
    speed,
    realAnchor: realNow,
    gameAnchor: now,
    used: state.runtime.testClock?.used === true || speed !== 1,
  };
  if (state.current && state.runtime.testClock.used)
    state.current.view.testRun = true;
  // A valid local command is proof of presence. Preserve 30 REAL seconds of grace.
  state.runtime.presence.validUntil = now + 30_000 * speed;
  const last = state.runtime.presence.intervals.at(-1);
  if (last && last.end >= now) last.end = state.runtime.presence.validUntil;
  return { speed, used: state.runtime.testClock.used };
}
