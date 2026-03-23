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
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { searchResumes } from '../../services/api';
import type { UserRecord } from '../../types';
import ErrorMessage from '../../components/ErrorMessage';

export default function SearchPage() {
  const { t } = useTranslation();
  const features = useFeatureFlags();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setSearched(false);
    try {
      const res = await searchResumes(query);
      setResults(res.data);
      setSearched(true);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>{t('search.title')}</Typography>
      {!features.resumeSearch && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('common.featureNotAvailable')}
        </Alert>
      )}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('search.searchResumes')}</Typography>
          <Box display="flex" gap={2} mb={3}>
            <TextField
              label={t('search.searchQuery')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && features.resumeSearch) void handleSearch(); }}
              fullWidth
              disabled={!features.resumeSearch}
              size="small"
            />
            <Button
              variant="contained"
              onClick={() => { void handleSearch(); }}
              disabled={!features.resumeSearch || loading || !query}
              startIcon={loading ? <CircularProgress size={16} /> : <SearchIcon />}
            >
              {t('search.title')}
            </Button>
          </Box>
          {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
          {searched && (
            <>
              <Typography variant="subtitle1">{t('search.results')}</Typography>
              {results.length === 0 ? (
                <Typography color="text.secondary">{t('search.noResults')}</Typography>
              ) : (
                <List>
                  {results.map((r) => (
                    <ListItem key={r.uid}>
                      <ListItemText primary={r.email} secondary={r.uid} />
                    </ListItem>
                  ))}
                </List>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
