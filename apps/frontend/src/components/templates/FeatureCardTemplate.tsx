/**
 * @file FeatureCardTemplate.tsx — Reusable platform feature summary card.
 *
 * Renders a small summary card advertising a platform feature. When the
 * feature is unavailable the card is rendered with reduced opacity and a
 * "coming soon" chip. When a `path` is provided and the feature is available
 * the card is clickable and navigates to that route on click.
 */
import type { ReactNode } from 'react';
import {
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Chip,
  Box,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

/** Props for the {@link FeatureCardTemplate} component. */
export interface FeatureCardTemplateProps {
  /** Display title for the feature. */
  title: string;
  /** Icon element shown beside the title. */
  icon: ReactNode;
  /** Whether the feature is currently available. */
  available: boolean;
  /** Description shown when the feature is available. */
  description: string;
  /** Navigation path for the feature. When provided and `available` is `true`, the card becomes clickable. */
  path?: string;
}

/**
 * Small summary card used to advertise a platform feature on the dashboard.
 * Renders with reduced opacity and a "coming soon" chip when `available` is
 * `false`. When a `path` is provided the card is clickable and navigates to
 * that route on click.
 */
export default function FeatureCardTemplate({ title, icon, available, description, path }: FeatureCardTemplateProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const content = (
    <CardContent>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        {icon}
        <Typography variant="h6">{title}</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary">{available ? description : t('dashboard.featureNotAvailable')}</Typography>
      {!available && (
        <Chip label={t('dashboard.comingSoon')} size="small" color="default" variant="outlined" sx={{ mt: 1.5 }} />
      )}
    </CardContent>
  );

  return (
    <Card sx={{ height: '100%', opacity: available ? 1 : 0.82 }}>
      {path && available ? (
        <CardActionArea
          sx={{ height: '100%' }}
          onClick={() => { void navigate(path); }}
        >
          {content}
        </CardActionArea>
      ) : content}
    </Card>
  );
}
