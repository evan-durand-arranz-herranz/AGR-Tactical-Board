import { FIELD } from '../types'
import type { Position } from '../types'

/**
 * Convert a normalized position (0–100% of field) to SVG coordinates.
 * The SVG viewport is FIELD.WIDTH × FIELD.HEIGHT user units.
 */
export function toSVG(pos: Position): { svgX: number; svgY: number } {
  return {
    svgX: (pos.x / 100) * FIELD.WIDTH,
    svgY: (pos.y / 100) * FIELD.HEIGHT,
  }
}

/**
 * Convert SVG coordinates back to normalized field position.
 */
export function fromSVG(svgX: number, svgY: number): Position {
  return {
    x: (svgX / FIELD.WIDTH) * 100,
    y: (svgY / FIELD.HEIGHT) * 100,
  }
}

/**
 * Clamp a position so it stays within visible field bounds (including bench areas).
 * Bench areas extend slightly beyond 0 and 100.
 */
export function clampPosition(pos: Position): Position {
  return {
    x: Math.max(-8, Math.min(108, pos.x)),
    y: Math.max(0, Math.min(100, pos.y)),
  }
}

/**
 * Linear interpolation between two positions.
 */
export function lerpPosition(a: Position, b: Position, t: number): Position {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  }
}

/**
 * Ease-in-out cubic interpolation (t in [0,1]).
 */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
