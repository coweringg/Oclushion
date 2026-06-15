import type { TourState } from "./tour.types.js";
import { z } from "zod";

const STORAGE_PREFIX = "ocl_tour_v1";

function key(tourId: string): string {
  return `${STORAGE_PREFIX}:${tourId}`;
}

export function readTourState(tourId: string, defaultState: TourState): TourState {
  try {
    const raw = globalThis.localStorage?.getItem(key(tourId));
    if (!raw) return defaultState;
    const zodParsed = z.record(z.string(), z.unknown()).safeParse(JSON.parse(raw));
    if (!zodParsed.success) return defaultState;
    const parsed = zodParsed.data as Partial<TourState>;
    if (typeof parsed.isActive !== "boolean") return defaultState;
    return { ...defaultState, ...parsed, version: defaultState.version } as TourState;
  } catch {
    return defaultState;
  }
}

export function writeTourState(tourId: string, state: TourState): void {
  try {
    globalThis.localStorage?.setItem(key(tourId), JSON.stringify(state));
  } catch {
  }
}

export function resetTourState(tourId: string): void {
  try {
    globalThis.localStorage?.removeItem(key(tourId));
  } catch {
  }
}
