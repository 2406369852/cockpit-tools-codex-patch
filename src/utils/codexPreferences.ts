const CODEX_SHOW_CODE_REVIEW_QUOTA_STORAGE_KEY = 'agtools.codex_show_code_review_quota';
const CODEX_SHOW_ADDITIONAL_QUOTA_STORAGE_KEY = 'agtools.codex_show_additional_quota';
const CODEX_PLAN_BADGE_STYLE_STORAGE_KEY = 'agtools.codex_plan_badge_style';

export const CODEX_CODE_REVIEW_QUOTA_VISIBILITY_CHANGED_EVENT =
  'agtools:codex-code-review-quota-visibility-changed';
export const CODEX_ADDITIONAL_QUOTA_VISIBILITY_CHANGED_EVENT =
  'agtools:codex-additional-quota-visibility-changed';
export const CODEX_PLAN_BADGE_STYLE_CHANGED_EVENT = 'agtools:codex-plan-badge-style-changed';

/** Style-only variants; plan label remains the raw plan value (no translation mapping). */
export type CodexPlanBadgeStyle = 'default' | 'outline' | 'soft' | 'mono';

const CODEX_PLAN_BADGE_STYLES: readonly CodexPlanBadgeStyle[] = [
  'default',
  'outline',
  'soft',
  'mono',
];

export function isCodexCodeReviewQuotaVisibleByDefault(): boolean {
  try {
    return localStorage.getItem(CODEX_SHOW_CODE_REVIEW_QUOTA_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isCodexAdditionalQuotaVisibleByDefault(): boolean {
  try {
    return localStorage.getItem(CODEX_SHOW_ADDITIONAL_QUOTA_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function persistCodexCodeReviewQuotaVisible(visible: boolean): void {
  try {
    localStorage.setItem(CODEX_SHOW_CODE_REVIEW_QUOTA_STORAGE_KEY, visible ? '1' : '0');
    window.dispatchEvent(
      new CustomEvent(CODEX_CODE_REVIEW_QUOTA_VISIBILITY_CHANGED_EVENT, { detail: visible }),
    );
  } catch {
    // ignore localStorage write failures
  }
}

export function persistCodexAdditionalQuotaVisible(visible: boolean): void {
  try {
    localStorage.setItem(CODEX_SHOW_ADDITIONAL_QUOTA_STORAGE_KEY, visible ? '1' : '0');
    window.dispatchEvent(
      new CustomEvent(CODEX_ADDITIONAL_QUOTA_VISIBILITY_CHANGED_EVENT, { detail: visible }),
    );
  } catch {
    // ignore localStorage write failures
  }
}

export function getCodexPlanBadgeStyle(): CodexPlanBadgeStyle {
  try {
    const raw = localStorage.getItem(CODEX_PLAN_BADGE_STYLE_STORAGE_KEY);
    if (raw && (CODEX_PLAN_BADGE_STYLES as readonly string[]).includes(raw)) {
      return raw as CodexPlanBadgeStyle;
    }
  } catch {
    // ignore
  }
  return 'default';
}

export function persistCodexPlanBadgeStyle(style: CodexPlanBadgeStyle): void {
  try {
    localStorage.setItem(CODEX_PLAN_BADGE_STYLE_STORAGE_KEY, style);
    window.dispatchEvent(
      new CustomEvent(CODEX_PLAN_BADGE_STYLE_CHANGED_EVENT, { detail: style }),
    );
  } catch {
    // ignore
  }
}

/** Append style-only class; never rewrite plan label text. */
export function withCodexPlanBadgeStyle(className: string, style?: CodexPlanBadgeStyle): string {
  const resolved = style ?? getCodexPlanBadgeStyle();
  if (resolved === 'default') {
    return className;
  }
  return `${className} plan-badge-style-${resolved}`.trim();
}
