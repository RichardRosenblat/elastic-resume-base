/**
 * @file SearchPage.tsx — Resume search and generation page.
 *
 * Provides two user-facing workflows:
 * 1. **Search** (`resumeSearch` flag) — semantic search against the resume index.
 * 2. **Generate** (`resumeGenerate` flag) — generates a resume document
 *    (PDF / DOCX) in the selected language and immediately downloads it.
 *    Only rendered when the `resumeGenerate` feature flag is enabled.
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
import { Search as SearchIcon, Download as DownloadIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { searchResumes, generateResume } from '../../services/api';
import { useShowApiError } from '../../hooks/useShowApiError';
import { useToast } from '../../contexts/use-toast';
import type { SearchResult } from '../../types';
import { FormTemplate, TableTemplate } from '../../components/templates';

export default function SearchPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const showApiError = useShowApiError();
  const features = useFeatureFlags();
  const [formValues, setFormValues] = useState<Record<string, string>>({ query: '' });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // ── Generate state ────────────────────────────────────────────────────────
  const [generateValues, setGenerateValues] = useState<Record<string, string>>({
    resumeId: '',
    language: 'en',
    format: 'pdf',
  });
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(false);
    try {
      const res = await searchResumes(formValues.query);
      setResults(res.data.results);
      setSearched(true);
    } catch (error) {
      showApiError(error, t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  // ── Generate handler ──────────────────────────────────────────────────────

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

  const getPrimaryText = (result: SearchResult): string => {
    const email = result.data.email;
    const name = result.data.name;
    if (typeof email === 'string' && email.length > 0) return email;
    if (typeof name === 'string' && name.length > 0) return name;
    return result.id;
  };

  const getSecondaryText = (result: SearchResult): string => {
    const uid = result.data.uid;
    if (typeof uid === 'string' && uid.length > 0) return uid;
    return `Score: ${result.score.toFixed(2)}`;
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 2.5 }}>{t('search.title')}</Typography>
      {!features.resumeSearch && !features.resumeGenerate && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('common.featureNotAvailable')}
        </Alert>
      )}
      <Card sx={{ mb: features.resumeGenerate ? 3 : 0 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('search.searchResumes')}</Typography>
          {!features.resumeSearch && (
            <Alert severity="info" sx={{ mb: 2, mt: 1.5, py: 0 }}>{t('dashboard.comingSoon')}</Alert>
          )}
          <FormTemplate
            config={{
              fields: [
                {
                  key: 'query',
                  label: t('search.searchQuery'),
                  type: 'text',
                  size: 'small',
                  minWidth: 280,
                  disabled: !features.resumeSearch,
                },
              ],
              buttons: [
                {
                  label: t('search.title'),
                  onClick: () => { void handleSearch(); },
                  variant: 'contained',
                  disabled: !features.resumeSearch || loading || !formValues.query,
                  startIcon: loading ? <CircularProgress size={16} /> : <SearchIcon />,
                },
              ],
              values: formValues,
              onChange: (key, value) => setFormValues((prev) => ({ ...prev, [key]: value })),
              onSend: features.resumeSearch ? () => { void handleSearch(); } : undefined,
            }}
          />
          {searched && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>{t('search.results')}</Typography>
              <TableTemplate
                config={{
                  columns: [
                    {
                      id: 'primary',
                      header: t('search.searchResumes'),
                      cell: (row: SearchResult) => getPrimaryText(row),
                    },
                    {
                      id: 'secondary',
                      header: 'UID / Score',
                      cell: (row: SearchResult) => getSecondaryText(row),
                    },
                  ],
                  rows: results,
                  getRowKey: (r: SearchResult) => r.id,
                  emptyMessage: t('search.noResults'),
                  size: 'small',
                }}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── Generate card — only shown when resumeGenerate flag is enabled ── */}
      {features.resumeGenerate && (
        <>
          <Divider sx={{ my: 3 }} />
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <DownloadIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                {t('resumes.generateResume')}
              </Typography>
              <FormTemplate
                config={{
                  fields: [
                    {
                      key: 'resumeId',
                      label: t('resumes.resumeId'),
                      type: 'text',
                      size: 'small',
                      minWidth: 240,
                    },
                    {
                      key: 'language',
                      label: t('resumes.language'),
                      type: 'select',
                      size: 'small',
                      minWidth: 120,
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
                      disabled: generateLoading || !generateValues.resumeId,
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
        </>
      )}
    </Box>
  );
}
