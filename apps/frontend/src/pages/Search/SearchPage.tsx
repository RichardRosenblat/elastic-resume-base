/**
 * @file SearchPage.tsx — Semantic resume search page.
 *
 * Sends a natural-language query to `POST /api/v1/search` via the BFF
 * Gateway and renders the ranked results. When the `resumeSearch` feature
 * flag is disabled, all controls are disabled and an informational banner
 * is shown.
 */
import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { searchResumes } from '../../services/api';
import { useShowApiError } from '../../hooks/useShowApiError';
import type { SearchResult } from '../../types';
import { FormTemplate, TableTemplate } from '../../components/templates';

export default function SearchPage() {
  const { t } = useTranslation();
  const showApiError = useShowApiError();
  const features = useFeatureFlags();
  const [formValues, setFormValues] = useState<Record<string, string>>({ query: '' });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

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
      {!features.resumeSearch && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('common.featureNotAvailable')}
        </Alert>
      )}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('search.searchResumes')}</Typography>
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
    </Box>
  );
}
