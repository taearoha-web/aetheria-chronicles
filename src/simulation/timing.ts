/** Authored GLB clip seconds. The simulation and view share this battle clock. */
export interface ActionTiming { duration: number; impact: number }

export const ACTION_TIMINGS: Record<string, { attack: ActionTiming; skills: readonly ActionTiming[] }> = {
  kael: {
    attack: { duration: 0.92, impact: 0.42 },
    skills: [{ duration: 1.15, impact: 0.48 }, { duration: 1.40, impact: 0.65 }, { duration: 1.85, impact: 1.00 }],
  },
  lyra: {
    attack: { duration: 1.10, impact: 0.52 },
    skills: [{ duration: 1.30, impact: 0.58 }, { duration: 1.50, impact: 0.70 }, { duration: 1.80, impact: 0.95 }],
  },
};

export function getActionTiming(heroId: string | undefined, action: 'attack' | 'skill', slot = 0): ActionTiming {
  const authored = heroId && Object.hasOwn(ACTION_TIMINGS, heroId) ? ACTION_TIMINGS[heroId] : undefined;
  if (action === 'attack') return authored?.attack ?? { duration: 0.45, impact: 0.18 };
  return authored?.skills[slot] ?? { duration: 0.90, impact: 0.38 };
}
