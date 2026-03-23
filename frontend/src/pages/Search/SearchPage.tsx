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
import { toUserFacingErrorMessage } from '../../services/api-error';
import type { SearchResult } from '../../types';
import ErrorMessage from '../../components/ErrorMessage';
import { useToast } from '../../contexts/use-toast';
import { useButtonLock } from '../../hooks/useButtonLock';

export default function SearchPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const features = useFeatureFlags();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { locked: searchLocked, wrap: wrapSearch } = useButtonLock();

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setSearched(false);
    try {
      const res = await searchResumes(query);
      setResults(res.data.results);
      setSearched(true);
    } catch (error) {
      const errorMessage = toUserFacingErrorMessage(error, t('common.error'));
      setError(errorMessage);
      showToast(errorMessage, { severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getPrimaryText = (result: SearchResult): string => {
    const email = result.data.email;
    const name = result.data.name;

    if (typeof email === 'string' && email.length > 0) {
      return email;
    }

    if (typeof name === 'string' && name.length > 0) {
      return name;
    }

    return result.id;
  };

  const getSecondaryText = (result: SearchResult): string => {
    const uid = result.data.uid;

    if (typeof uid === 'string' && uid.length > 0) {
      return uid;
    }

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
          <Box display="flex" gap={2} mb={3} alignItems="center" flexWrap="wrap">
            <TextField
              label={t('search.searchQuery')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && features.resumeSearch) void handleSearch(); }}
              fullWidth
              disabled={!features.resumeSearch}
              size="small"
              sx={{ minWidth: 280, flex: 1 }}
            />
            <Button
              variant="contained"
              onClick={wrapSearch(handleSearch)}
              disabled={!features.resumeSearch || loading || !query || searchLocked}
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
                    <ListItem key={r.id}>
                      <ListItemText primary={getPrimaryText(r)} secondary={getSecondaryText(r)} />
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
