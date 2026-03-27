/**
 * @file ResumesPage.tsx — Resume ingest and generation page.
 *
 * Provides two feature-flagged workflows:
 * 1. **Ingest** (`resumeIngest` flag) — triggers a background ingest job by
 *    submitting a Google Sheets ID to `POST /api/v1/resumes/ingest`.
 * 2. **Generate** (`resumeGenerate` flag) — generates a resume document
 *    (PDF / DOCX) in the selected language and immediately downloads it.
 *
 * When both flags are disabled an informational banner is shown instead of
 * the controls.
 */
import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Download as DownloadIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { triggerResumeIngest, generateResume } from '../../services/api';
import { useShowApiError } from '../../hooks/useShowApiError';
import { useToast } from '../../contexts/use-toast';
import { FormTemplate } from '../../components/templates';

export default function ResumesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const showApiError = useShowApiError();
  const features = useFeatureFlags();
  const [ingestValues, setIngestValues] = useState<Record<string, string>>({ sheetId: '' });
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);
  const [generateValues, setGenerateValues] = useState<Record<string, string>>({
    resumeId: '',
    language: 'en',
    format: 'pdf',
  });
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);

  const handleIngest = async () => {
    setIngestLoading(true);
    setIngestSuccess(null);
    try {
      const job = await triggerResumeIngest({ sheetId: ingestValues.sheetId });
      const successMessage = `Job ${job.jobId} submitted`;
      setIngestSuccess(successMessage);
      showToast(successMessage, { severity: 'success' });
    } catch (error) {
      showApiError(error, t('common.error'));
    } finally {
      setIngestLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerateLoading(true);
    setGenerateSuccess(null);
    try {
      const job = await generateResume(generateValues.resumeId, {
        language: generateValues.language,
        format: generateValues.format,
      });

      let successMessage: string;
      if ('downloadUrl' in job && typeof job.downloadUrl === 'string' && job.downloadUrl.length > 0) {
        window.open(job.downloadUrl, '_blank', 'noopener,noreferrer');
        successMessage = `Generation job ${job.jobId} submitted. Download opened.`;
      } else if ('driveLink' in job && typeof job.driveLink === 'string' && job.driveLink.length > 0) {
        window.open(job.driveLink, '_blank', 'noopener,noreferrer');
        successMessage = `Generation job ${job.jobId} submitted. Drive link opened.`;
      } else {
        successMessage = `Generation job ${job.jobId} submitted.`;
      }
      setGenerateSuccess(successMessage);
      showToast(successMessage, { severity: 'success' });
    } catch (error) {
      showApiError(error, t('common.error'));
    } finally {
      setGenerateLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 2.5 }}>{t('resumes.title')}</Typography>

      {!features.resumeIngest && !features.resumeGenerate && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('common.featureNotAvailable')}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <CloudUploadIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            {t('resumes.ingestResumes')}
          </Typography>
          {!features.resumeIngest && (
            <Alert severity="info" sx={{ mt: 1.5, py: 0 }}>{t('dashboard.comingSoon')}</Alert>
          )}
          <FormTemplate
            config={{
              fields: [
                {
                  key: 'sheetId',
                  label: t('resumes.sheetId'),
                  type: 'text',
                  size: 'small',
                  minWidth: 240,
                  disabled: !features.resumeIngest,
                },
              ],
              buttons: [
                {
                  label: t('resumes.submit'),
                  onClick: () => { void handleIngest(); },
                  variant: 'contained',
                  disabled: !features.resumeIngest || ingestLoading || !ingestValues.sheetId,
                  startIcon: ingestLoading ? <CircularProgress size={16} /> : undefined,
                },
              ],
              values: ingestValues,
              onChange: (key, value) => setIngestValues((prev) => ({ ...prev, [key]: value })),
            }}
          />
          {ingestSuccess && <Alert severity="success" sx={{ mt: 2 }}>{ingestSuccess}</Alert>}
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }} />

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <DownloadIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            {t('resumes.generateResume')}
          </Typography>
          {!features.resumeGenerate && (
            <Alert severity="info" sx={{ mt: 1.5, py: 0 }}>{t('dashboard.comingSoon')}</Alert>
          )}
          <FormTemplate
            config={{
              fields: [
                {
                  key: 'resumeId',
                  label: t('resumes.batchId'),
                  type: 'text',
                  size: 'small',
                  minWidth: 240,
                  disabled: !features.resumeGenerate,
                },
                {
                  key: 'language',
                  label: t('resumes.language'),
                  type: 'select',
                  size: 'small',
                  minWidth: 120,
                  disabled: !features.resumeGenerate,
                  options: [
                    { value: 'en', label: 'English' },
                    { value: 'pt-BR', label: 'Português' },
                    { value: 'es', label: 'Español' },
                  ],
                },
                {
                  key: 'format',
                  label: t('resumes.format'),
                  type: 'select',
                  size: 'small',
                  minWidth: 100,
                  disabled: !features.resumeGenerate,
                  options: [
                    { value: 'pdf', label: 'PDF' },
                    { value: 'docx', label: 'DOCX' },
                  ],
                },
              ],
              buttons: [
                {
                  label: t('resumes.submit'),
                  onClick: () => { void handleGenerate(); },
                  variant: 'contained',
                  disabled: !features.resumeGenerate || generateLoading || !generateValues.resumeId,
                  startIcon: generateLoading ? <CircularProgress size={16} /> : undefined,
                },
              ],
              values: generateValues,
              onChange: (key, value) => setGenerateValues((prev) => ({ ...prev, [key]: value })),
            }}
          />
          {generateSuccess && <Alert severity="success" sx={{ mt: 2 }}>{generateSuccess}</Alert>}
        </CardContent>
      </Card>
    </Box>
  );
}
