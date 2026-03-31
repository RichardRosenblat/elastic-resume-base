import { describe, it, expect } from 'vitest';
import { loadTheme, resolveLogoUrl, resolveVariables } from './loadTheme';
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

  it('exposes backgroundAnimation when configured', () => {
    const theme = loadTheme();
    if (theme.backgroundAnimation) {
      expect(typeof theme.backgroundAnimation.enabled === 'boolean' || theme.backgroundAnimation.enabled === undefined).toBe(true);
    }
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

  it('includes background animation CSS variables when configured', () => {
    const theme = loadTheme();
    const vars = toCssVariables(theme);

    if (!theme.backgroundAnimation?.enabled) return;

    const anim = theme.backgroundAnimation;
    const colors = anim.palette?.colors ?? [];
    for (let i = 0; i < colors.length; i++) {
      expect(vars[`--bg-anim-color-${i}`]).toBe(colors[i]);
    }
    if (anim.speed !== undefined) {
      expect(vars['--bg-anim-speed']).toBe(`${anim.speed}s`);
    }
    if (anim.opacity !== undefined) {
      expect(vars['--bg-anim-opacity']).toBe(String(anim.opacity));
    }
  });

  it('uses the dark preset animation colours when mode is dark', () => {
    const theme = loadTheme();
    if (!theme.backgroundAnimation?.presets?.['dark']?.colors) return;

    const vars = toCssVariables(theme, 'dark');
    const darkColors = theme.backgroundAnimation.presets['dark'].colors;
    for (let i = 0; i < (darkColors?.length ?? 0); i++) {
      expect(vars[`--bg-anim-color-${i}`]).toBe(darkColors?.[i]);
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

describe('resolveVariables', () => {
  it('returns the object unchanged when no variables key is present', () => {
    const raw = { mode: 'light', palette: { primary: { main: '#000' } } };
    expect(resolveVariables(raw)).toEqual(raw);
  });

  it('replaces $varName references with the declared variable value', () => {
    const raw = {
      variables: { brand: '#1F5AA6' },
      palette: { primary: { main: '$brand' } },
    };
    const result = resolveVariables(raw) as { palette: { primary: { main: string } } };
    expect(result.palette.primary.main).toBe('#1F5AA6');
  });

  it('leaves undeclared $references unchanged', () => {
    const raw = {
      variables: { brand: '#1F5AA6' },
      palette: { primary: { main: '$unknown' } },
    };
    const result = resolveVariables(raw) as { palette: { primary: { main: string } } };
    expect(result.palette.primary.main).toBe('$unknown');
  });

  it('does not resolve variable references inside the variables block itself', () => {
    const raw = {
      variables: { a: '#AAA', b: '$a' },
      palette: { primary: { main: '$b' } },
    };
    const result = resolveVariables(raw) as {
      variables: { b: string };
      palette: { primary: { main: string } };
    };
    // variables.b stays as '$a' (no self-substitution)
    expect(result.variables.b).toBe('$a');
    // palette.primary.main resolves $b → '$a' (raw variable value, not further resolved)
    expect(result.palette.primary.main).toBe('$a');
  });

  it('resolves variables inside nested objects and arrays', () => {
    const raw = {
      variables: { white: '#FFFFFF' },
      palette: {
        alerts: { success: { filledColor: '$white' } },
        list: ['$white'],
      },
    };
    const result = resolveVariables(raw) as {
      palette: { alerts: { success: { filledColor: string } }; list: string[] };
    };
    expect(result.palette.alerts.success.filledColor).toBe('#FFFFFF');
    expect(result.palette.list[0]).toBe('#FFFFFF');
  });

  it('resolves variables in theme.json so loaded palette colours match expected values', () => {
    const theme = loadTheme();
    // The template theme.json defines $primaryMain = '#1F5AA6'
    expect(theme.palette.primary.main).toBe('#1F5AA6');
    // The template theme.json defines $white = '#FFFFFF'
    expect(theme.palette.primary.contrastText).toBe('#FFFFFF');
    expect(theme.palette.background.paper).toBe('#FFFFFF');
  });

  it('sidebar items in the loaded theme have no adminOnly or hidden properties', () => {
    const theme = loadTheme();
    for (const item of theme.sidebar?.items ?? []) {
      expect(item).not.toHaveProperty('adminOnly');
      expect(item).not.toHaveProperty('hidden');
    }
  });
});
