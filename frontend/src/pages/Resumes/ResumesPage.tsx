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
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Download as DownloadIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { triggerResumeIngest, generateResume } from '../../services/api';
import { toUserFacingErrorMessage } from '../../services/api-error';
import ErrorMessage from '../../components/ErrorMessage';
import { useToast } from '../../contexts/use-toast';

export default function ResumesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const features = useFeatureFlags();
  const [sheetId, setSheetId] = useState('');
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [resumeId, setResumeId] = useState('');
  const [language, setLanguage] = useState('en');
  const [format, setFormat] = useState('pdf');
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleIngest = async () => {
    setIngestLoading(true);
    setIngestError(null);
    setIngestSuccess(null);
    try {
      const job = await triggerResumeIngest({ sheetId });
      const successMessage = `Job ${job.jobId} submitted`;
      setIngestSuccess(successMessage);
      showToast(successMessage, { severity: 'success' });
    } catch (error) {
      const errorMessage = toUserFacingErrorMessage(error, t('common.error'));
      setIngestError(errorMessage);
      showToast(errorMessage, { severity: 'error' });
    } finally {
      setIngestLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerateLoading(true);
    setGenerateSuccess(null);
    setGenerateError(null);
    try {
      const job = await generateResume(resumeId, { language, format });

      if ('downloadUrl' in job && typeof job.downloadUrl === 'string' && job.downloadUrl.length > 0) {
        window.open(job.downloadUrl, '_blank', 'noopener,noreferrer');
        const successMessage = `Generation job ${job.jobId} submitted. Download opened.`;
        setGenerateSuccess(successMessage);
        showToast(successMessage, { severity: 'success' });
      } else if ('driveLink' in job && typeof job.driveLink === 'string' && job.driveLink.length > 0) {
        window.open(job.driveLink, '_blank', 'noopener,noreferrer');
        const successMessage = `Generation job ${job.jobId} submitted. Drive link opened.`;
        setGenerateSuccess(successMessage);
        showToast(successMessage, { severity: 'success' });
      } else {
        const successMessage = `Generation job ${job.jobId} submitted.`;
        setGenerateSuccess(successMessage);
        showToast(successMessage, { severity: 'success' });
      }
    } catch (error) {
      const errorMessage = toUserFacingErrorMessage(error, t('common.error'));
      setGenerateError(errorMessage);
      showToast(errorMessage, { severity: 'error' });
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
          <Box display="flex" gap={2} mt={2} flexWrap="wrap" alignItems="center">
            <TextField
              label={t('resumes.sheetId')}
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
              size="small"
              disabled={!features.resumeIngest}
              sx={{ minWidth: 240 }}
            />
            <Button
              variant="contained"
              onClick={() => { void handleIngest(); }}
              disabled={!features.resumeIngest || ingestLoading || !sheetId}
              startIcon={ingestLoading ? <CircularProgress size={16} /> : undefined}
            >
              {t('resumes.submit')}
            </Button>
          </Box>
          {ingestSuccess && <Alert severity="success" sx={{ mt: 2 }}>{ingestSuccess}</Alert>}
          {ingestError && <ErrorMessage message={ingestError} onClose={() => setIngestError(null)} />}
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
          <Box display="flex" gap={2} mt={2} flexWrap="wrap" alignItems="center">
            <TextField
              label={t('resumes.batchId')}
              value={resumeId}
              onChange={(e) => setResumeId(e.target.value)}
              size="small"
              disabled={!features.resumeGenerate}
              sx={{ minWidth: 240 }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>{t('resumes.language')}</InputLabel>
              <Select
                value={language}
                label={t('resumes.language')}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={!features.resumeGenerate}
              >
                <MenuItem value="en">English</MenuItem>
                <MenuItem value="pt-BR">Português</MenuItem>
                <MenuItem value="es">Español</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>{t('resumes.format')}</InputLabel>
              <Select
                value={format}
                label={t('resumes.format')}
                onChange={(e) => setFormat(e.target.value)}
                disabled={!features.resumeGenerate}
              >
                <MenuItem value="pdf">PDF</MenuItem>
                <MenuItem value="docx">DOCX</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              onClick={() => { void handleGenerate(); }}
              disabled={!features.resumeGenerate || generateLoading || !resumeId}
              startIcon={generateLoading ? <CircularProgress size={16} /> : undefined}
            >
              {t('resumes.submit')}
            </Button>
          </Box>
          {generateSuccess && <Alert severity="success" sx={{ mt: 2 }}>{generateSuccess}</Alert>}
          {generateError && <ErrorMessage message={generateError} onClose={() => setGenerateError(null)} />}
        </CardContent>
      </Card>
    </Box>
  );
}
