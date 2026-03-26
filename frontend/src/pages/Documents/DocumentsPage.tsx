/**
 * @file DocumentsPage.tsx — OCR document processing page.
 *
 * Allows authenticated users to upload one or more document files (PDF, images,
 * DOCX, or ZIP archives) to the document reader service via the BFF OCR endpoint.
 * After processing, an Excel workbook containing the extracted structured data is
 * automatically downloaded.
 *
 * The upload UI is gated by the `documentRead` feature flag. When the flag is
 * disabled an informational banner is shown instead.
 */
import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import {
  AttachFile as AttachFileIcon,
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { ocrDocuments } from '../../services/api';
import { toUserFacingErrorMessage } from '../../services/api-error';
import { useToast } from '../../contexts/use-toast';

/** File extensions the document reader service accepts for direct OCR. */
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.tiff,.tif,.bmp,.webp,.docx,.zip';

/** Maximum number of files that can be uploaded in a single request. */
const MAX_FILES = 20;

export default function DocumentsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const features = useFeatureFlags();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > MAX_FILES) {
      showToast(t('documents.tooManyFiles', { max: MAX_FILES }), { severity: 'warning' });
      return;
    }
    setSelectedFiles(files);
    setDownloadReady(false);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setLoading(true);
    setDownloadReady(false);

    try {
      const blob = await ocrDocuments(selectedFiles);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'extracted_documents.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setDownloadReady(true);
      showToast(t('documents.downloadReady'), { severity: 'success' });
    } catch (error) {
      const errorMessage = toUserFacingErrorMessage(error, t('common.error'));
      showToast(errorMessage, { severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setDownloadReady(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 2.5 }}>
        {t('documents.title')}
      </Typography>

      {!features.documentRead && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('common.featureNotAvailable')}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <CloudUploadIcon color="primary" />
            <Typography variant="h6">{t('documents.uploadDocuments')}</Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('documents.uploadDescription')}
          </Typography>

          <Box display="flex" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
            {['PDF', 'JPEG', 'PNG', 'TIFF', 'BMP', 'WebP', 'DOCX', 'ZIP'].map((ext) => (
              <Chip key={ext} label={ext} size="small" variant="outlined" />
            ))}
          </Box>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
            disabled={!features.documentRead || loading}
          />

          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<AttachFileIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={!features.documentRead || loading}
            >
              {t('documents.selectFiles')}
            </Button>

            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <DescriptionIcon />}
              onClick={() => { void handleUpload(); }}
              disabled={!features.documentRead || loading || selectedFiles.length === 0}
            >
              {loading ? t('documents.processing') : t('documents.processAndDownload')}
            </Button>

            {selectedFiles.length > 0 && (
              <Button variant="text" onClick={handleClear} disabled={loading}>
                {t('common.cancel')}
              </Button>
            )}
          </Box>

          {selectedFiles.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('documents.selectedFiles', { count: selectedFiles.length })}
              </Typography>
              <List dense disablePadding>
                {selectedFiles.map((file) => (
                  <ListItem key={`${file.name}-${file.size}`} disableGutters>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <AttachFileIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={file.name}
                      secondary={`${(file.size / 1024).toFixed(1)} KB`}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {downloadReady && (
            <Alert severity="success" icon={<DownloadIcon />} sx={{ mt: 2 }}>
              {t('documents.downloadReady')}
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
