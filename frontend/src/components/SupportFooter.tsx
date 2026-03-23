/**
 * @file SupportFooter.tsx — Page-level support contact footer.
 *
 * Renders a subtle footer bar with a "Something not working as expected?
 * Contact support" prompt and a `mailto:` link to the configured support
 * email address.
 *
 * The footer is only rendered when `config.supportEmail` is non-empty so
 * that deployments without a support address show nothing.
 *
 * @example
 * // Place at the bottom of any page or layout component:
 * <SupportFooter />
 */
import { Box, Link, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { config } from '../config';

/**
 * Sticky footer that prompts users to contact support via email.
 * Renders nothing when `config.supportEmail` is an empty string.
 */
export default function SupportFooter() {
  const { t } = useTranslation();

  if (!config.supportEmail) return null;

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        pt: 4,
        pb: 2,
        textAlign: 'center',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {t('support.notWorking')}{' '}
        <Link
          href={`mailto:${config.supportEmail}`}
          color="primary"
          underline="hover"
          variant="caption"
        >
          {t('support.contactSupport')}
        </Link>
      </Typography>
    </Box>
  );
}
