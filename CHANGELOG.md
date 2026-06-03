# R3F-MONITOR

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/).

## 2.0.0 - 2026-06-02

Reworked measurement core. The `1.x` line (last release `1.2.0`) is now closed
and keeps the legacy logic; pin to `1.2.0` if you depend on the old behavior.

### Added

- **New measurement engine** (WebGL-only):
  - **FPS** measured over a real 1-second sliding window, reported as a continuous (non-integer) value and smoothed with a light EMA to remove ±1 flicker.
  - **CPU** measured as render-phase wall-clock time accumulated per frame via `performance.now()`.
  - **GPU** measured with a WebGL2 timer-query queue (`EXT_disjoint_timer_query_webgl2`), reported in true milliseconds.
- Bar graph (`graphType: "bar"`): left-scrolling render with a fixed high-water vertical scale and a per-metric gradient fill; header now shows the current value with a colored unit suffix.

### Changed

- **GPU time is now reported in real milliseconds** instead of the previous scaled value. Re-baseline any thresholds that compared against `1.x` numbers.
- CPU measurement switched from the `performance.mark`/`performance.measure` (User Timing) approach to `performance.now()` accumulation (lighter, avoids the iOS `measure` null quirk).

### Removed

- **Overclock mode.** The `overClock` prop and the V-Sync-bypass FPS estimation (`requestIdleCallback`-based) have been removed, along with the related `overclockingFps` state and 120Hz auto-detection. (Still available in `1.2.0`.)

### Migration

- Remove the `overClock` prop from `<PerfMonitor />`. To keep overclock, pin to `r3f-monitor@1.2.0`.

## 1.2.0

Final release of the `1.x` line — retains the legacy FPS/CPU/GPU logic and overclock mode.

## 1.0.2

### Fixed

- Fix some errors and warnings.

## 1.0.0

### Added

- Introduced the new monitor UI.

## 0.1.0

### Added

- Initial release.
