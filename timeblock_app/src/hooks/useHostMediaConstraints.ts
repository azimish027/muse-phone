import { useEffect, useState } from 'react';

export type HostMediaConstraints = Readonly<{
  hostPaused: boolean;
  hostMuted: boolean;
  revision: number;
}>;

const FALLBACK_CONSTRAINTS: HostMediaConstraints = Object.freeze({
  hostPaused: false,
  hostMuted: false,
  revision: -1,
});

const readConstraints = (): HostMediaConstraints => {
  return window.lingguang?.media?.getConstraints?.() ?? FALLBACK_CONSTRAINTS;
};

/**
 * Mirrors host media constraints into React state. The runtime already
 * enforces the constraint; consumers should only derive UI state from it.
 */
export const useHostMediaConstraints = (): HostMediaConstraints => {
  const [constraints, setConstraints] = useState<HostMediaConstraints>(readConstraints);

  useEffect(() => {
    const media = window.lingguang?.media;
    if (!media?.subscribeConstraints) return;
    return media.subscribeConstraints(setConstraints);
  }, []);

  return constraints;
};
