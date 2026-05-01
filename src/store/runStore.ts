import { create } from 'zustand';
import type { Run, Territory } from '../types';

type RunState = {
  currentRun: Run | null;
  territories: Territory[];
  startRun: () => void;
  endRun: () => void;
  addTerritory: (t: Territory) => void;
};

export const useRunStore = create<RunState>((set) => ({
  currentRun: null,
  territories: [],
  startRun: () =>
    set({
      currentRun: {
        id: `run_${Date.now()}`,
        startedAt: Date.now(),
        endedAt: null,
        points: [],
        distanceMeters: 0,
      },
    }),
  endRun: () =>
    set((s) =>
      s.currentRun
        ? { currentRun: { ...s.currentRun, endedAt: Date.now() } }
        : s,
    ),
  addTerritory: (t) =>
    set((s) => ({ territories: [...s.territories, t] })),
}));
