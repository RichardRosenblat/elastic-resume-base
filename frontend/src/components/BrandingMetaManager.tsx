import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme';

const DEFAULT_FAVICON = '/favicon.svg';

function resolvePageTitle(pathname: string, t: (key: string) => string): string {
  if (pathname === '/') return t('nav.dashboard');
  if (pathname.startsWith('/login')) return t('auth.login');
  if (pathname.startsWith('/users')) return t('nav.users');
  if (pathname.startsWith('/resumes')) return t('nav.resumes');
  if (pathname.startsWith('/search')) return t('nav.search');
  if (pathname.startsWith('/account')) return t('nav.account');
  return t('common.notFound');
}

function ensureFaviconElement(): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (existing) return existing;

  const created = document.createElement('link');
  created.rel = 'icon';
  document.head.appendChild(created);
  return created;
}

export default function BrandingMetaManager() {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { theme } = useAppTheme();

  useEffect(() => {
    const pageTitle = resolvePageTitle(location.pathname, t);
    const appName = theme.branding.appName || 'Elastic Resume Base';
    const companyName = theme.branding.companyName || '';
    const tenantSuffix = companyName && companyName !== appName ? ` - ${companyName}` : '';

    document.title = `${pageTitle} | ${appName}${tenantSuffix}`;

    const favicon = ensureFaviconElement();
    favicon.href = theme.branding.logoUrl || DEFAULT_FAVICON;
  }, [
    location.pathname,
    t,
    i18n.language,
    theme.branding.appName,
    theme.branding.companyName,
    theme.branding.logoUrl,
  ]);

  return null;
}
