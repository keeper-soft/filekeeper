// Lightweight helper for consuming app-level CSS variables (CSS custom properties)
// Provides both `var(...)` strings suitable for use in makeStyles and a runtime hook
// to read computed values if you need the concrete values in JS.

export const appTokens = {
  spacingSm: 'var(--app-spacing-sm)',
  spacingMd: 'var(--app-spacing-md)',
  spacingLg: 'var(--app-spacing-lg)',
  spacingXl: 'var(--app-spacing-xl)',
  paddingBottom: 'var(--app-padding-bottom)',
  maxHeight: 'var(--app-max-height)',
  headerBg: 'var(--app-header-bg)',
  headerBackdropFilter: 'var(--app-header-backdrop-filter)',
}

export const useAppTokens = () => {
  if (typeof window === 'undefined' || !document || !document.documentElement) {
    // return the var() references as a safe fallback for SSR
    return appTokens
  }

  const styles = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => {
    const v = styles.getPropertyValue(name).trim()
    return v || fallback
  }

  return {
    spacingSm: read('--app-spacing-sm', '8px'),
    spacingMd: read('--app-spacing-md', '12px'),
    spacingLg: read('--app-spacing-lg', '20px'),
    spacingXl: read('--app-spacing-xl', '32px'),
    paddingBottom: read('--app-padding-bottom', '24px'),
    maxHeight: read('--app-max-height', '720px'),
    headerBg: read('--app-header-bg', 'rgba(255,255,255,0.72)'),
    headerBackdropFilter: read('--app-header-backdrop-filter', 'none'),
  }
}

