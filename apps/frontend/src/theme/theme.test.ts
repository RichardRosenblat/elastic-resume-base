import { describe, it, expect } from 'vitest';
import { loadTheme, resolveLogoUrl } from './loadTheme';
import { toCssVariables } from './toCssVariables';

describe('loadTheme', () => {
  it('loads the theme without throwing', () => {
    expect(() => loadTheme()).not.toThrow();
  });

  it('returns a valid AppTheme object', () => {
    const theme = loadTheme();
    expect(theme.mode).toMatch(/^(light|dark)$/);
    expect(theme.branding).toBeDefined();
    expect(theme.palette).toBeDefined();
    expect(theme.typography).toBeDefined();
  });

  it('exposes primary and secondary palette roles', () => {
    const theme = loadTheme();
    expect(typeof theme.palette.primary.main).toBe('string');
    expect(typeof theme.palette.secondary.main).toBe('string');
  });

  it('exposes branding app and company names', () => {
    const theme = loadTheme();
    expect(typeof theme.branding.appName).toBe('string');
    expect(theme.branding.appName.length).toBeGreaterThan(0);
    expect(typeof theme.branding.companyName).toBe('string');
    expect(theme.branding.companyName.length).toBeGreaterThan(0);
    expect(typeof theme.branding.appLogoUrl).toBe('string');
    expect(typeof theme.branding.companyLogoUrl).toBe('string');
  });
});

describe('toCssVariables', () => {
  it('generates required CSS variables', () => {
    const theme = loadTheme();
    const vars = toCssVariables(theme);
    expect(vars['--color-primary-main']).toBe(theme.palette.primary.main);
    expect(vars['--color-secondary-main']).toBe(theme.palette.secondary.main);
    expect(vars['--color-background-default']).toBe(theme.palette.background.default);
    expect(vars['--color-background-paper']).toBe(theme.palette.background.paper);
    expect(vars['--color-text-primary']).toBe(theme.palette.text.primary);
    expect(vars['--color-text-secondary']).toBe(theme.palette.text.secondary);
    expect(vars['--font-family']).toBe(theme.typography.fontFamily);
  });

  it('includes optional colour variants when present', () => {
    const theme = loadTheme();
    const vars = toCssVariables(theme);
    if (theme.palette.primary.light) {
      expect(vars['--color-primary-light']).toBe(theme.palette.primary.light);
    }
    if (theme.palette.primary.dark) {
      expect(vars['--color-primary-dark']).toBe(theme.palette.primary.dark);
    }
  });

  it('includes tertiary variables when palette.tertiary is defined', () => {
    const theme = loadTheme();
    if (theme.palette.tertiary) {
      const vars = toCssVariables(theme);
      expect(vars['--color-tertiary-main']).toBe(theme.palette.tertiary.main);
    }
  });

  it('includes extended UI variables when configured', () => {
    const theme = loadTheme();
    const vars = toCssVariables(theme);

    if (theme.palette.background.sidebar) {
      expect(vars['--color-background-sidebar']).toBe(theme.palette.background.sidebar);
    }
    if (theme.palette.ui?.border) {
      expect(vars['--color-ui-border']).toBe(theme.palette.ui.border);
    }
  });

  it('includes alert colour variables when palette.alerts is configured', () => {
    const theme = loadTheme();
    const vars = toCssVariables(theme);
    const severities = ['success', 'warning', 'error', 'info', 'default'] as const;
    for (const severity of severities) {
      const tone = theme.palette.alerts?.[severity];
      if (tone?.bg) {
        expect(vars[`--color-alert-${severity}-bg`]).toBe(tone.bg);
      }
      if (tone?.color) {
        expect(vars[`--color-alert-${severity}-color`]).toBe(tone.color);
      }
      if (tone?.filledBg) {
        expect(vars[`--color-alert-${severity}-filled-bg`]).toBe(tone.filledBg);
      }
      if (tone?.filledColor) {
        expect(vars[`--color-alert-${severity}-filled-color`]).toBe(tone.filledColor);
      }
    }
  });
});

describe('resolveLogoUrl', () => {
  it('returns empty string unchanged', () => {
    expect(resolveLogoUrl('')).toBe('');
  });

  it('returns mdi: icons unchanged', () => {
    expect(resolveLogoUrl('mdi:briefcase')).toBe('mdi:briefcase');
  });

  it('returns https:// URLs unchanged', () => {
    expect(resolveLogoUrl('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png');
  });

  it('returns http:// URLs unchanged', () => {
    expect(resolveLogoUrl('http://localhost:3000/logo.png')).toBe('http://localhost:3000/logo.png');
  });

  it('returns protocol-relative // URLs unchanged', () => {
    expect(resolveLogoUrl('//cdn.example.com/logo.svg')).toBe('//cdn.example.com/logo.svg');
  });

  it('returns data: URIs unchanged', () => {
    expect(resolveLogoUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  it('returns root-relative /paths unchanged', () => {
    expect(resolveLogoUrl('/logo.png')).toBe('/logo.png');
    expect(resolveLogoUrl('/assets/images/logo.svg')).toBe('/assets/images/logo.svg');
  });

  it('prefixes a bare filename with / to point to the dist/public folder', () => {
    expect(resolveLogoUrl('logo.png')).toBe('/logo.png');
    expect(resolveLogoUrl('brand-logo.svg')).toBe('/brand-logo.svg');
  });

  it('strips leading ./ from relative paths and prefixes with /', () => {
    expect(resolveLogoUrl('./logo.png')).toBe('/logo.png');
    expect(resolveLogoUrl('./images/brand.svg')).toBe('/images/brand.svg');
  });

  it('prefixes sub-folder paths without ./ with /', () => {
    expect(resolveLogoUrl('images/logo.png')).toBe('/images/logo.png');
  });
});
