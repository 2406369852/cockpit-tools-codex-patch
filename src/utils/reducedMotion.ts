const REDUCED_MOTION_ATTRIBUTE = 'data-reduced-motion';

export type ScrollBehaviorMode = 'auto' | 'smooth';

const isBrowser = typeof document !== 'undefined';

export const applyReducedMotion = (enabled: boolean) => {
  if (!isBrowser) {
    return;
  }

  document.documentElement.setAttribute(REDUCED_MOTION_ATTRIBUTE, enabled ? 'true' : 'false');
};

export const isReducedMotionEnabled = () =>
  isBrowser && document.documentElement.getAttribute(REDUCED_MOTION_ATTRIBUTE) === 'true';

export const getReducedMotionScrollBehavior = (): ScrollBehaviorMode =>
  isReducedMotionEnabled() ? 'auto' : 'smooth';

export const scrollElementIntoView = (
  element: Element | null | undefined,
  options: Omit<ScrollIntoViewOptions, 'behavior'> & { behavior?: ScrollBehaviorMode },
) => {
  if (!element) {
    return;
  }

  element.scrollIntoView({
    ...options,
    behavior: options.behavior ?? getReducedMotionScrollBehavior(),
  });
};

export const scrollElementTo = (
  element: Element | null | undefined,
  options: Omit<ScrollToOptions, 'behavior'> & { behavior?: ScrollBehaviorMode },
) => {
  if (!element || typeof (element as Element & { scrollTo?: unknown }).scrollTo !== 'function') {
    return;
  }

  (element as Element & { scrollTo: (options: ScrollToOptions) => void }).scrollTo({
    ...options,
    behavior: options.behavior ?? getReducedMotionScrollBehavior(),
  });
};
