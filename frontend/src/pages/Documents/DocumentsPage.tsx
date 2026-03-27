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
import { useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Typography,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { ocrDocuments } from '../../services/api';
import { toUserFacingErrorMessage } from '../../services/api-error';
import { useToast } from '../../contexts/use-toast';
import { FileUploadTemplate } from '../../components/templates';
import type { FileUploadConfig } from '../../components/templates';

/** File extensions the document reader service accepts for direct OCR. */
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.tiff,.tif,.bmp,.webp,.docx,.zip';

/** Maximum number of files that can be uploaded in a single request. */
const MAX_FILES = 20;

/** Supported format labels shown as chips in the file upload section. */
const ACCEPTED_FORMATS = ['PDF', 'JPEG', 'PNG', 'TIFF', 'BMP', 'WebP', 'DOCX', 'ZIP'];

export default function DocumentsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const features = useFeatureFlags();

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);

  const handleFilesChange = (files: File[]) => {
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

  const uploadConfig: FileUploadConfig = {
    accept: ACCEPTED_EXTENSIONS,
    multiple: true,
    maxFiles: MAX_FILES,
    disabled: !features.documentRead,
    loading,
    files: selectedFiles,
    onFilesChange: handleFilesChange,
    description: t('documents.uploadDescription'),
    acceptedFormats: ACCEPTED_FORMATS,
    showSuccess: downloadReady,
    successMessage: t('documents.downloadReady'),
    selectFilesLabel: t('documents.selectFiles'),
    clearLabel: t('common.cancel'),
    selectedFilesLabel: t('documents.selectedFiles', { count: selectedFiles.length }),
    buttons: [
      {
        label: loading ? t('documents.processing') : t('documents.processAndDownload'),
        onClick: handleUpload,
        variant: 'contained',
        disabled: !features.documentRead || loading || selectedFiles.length === 0,
        startIcon: loading ? <CircularProgress size={16} color="inherit" /> : <DescriptionIcon />,
      },
    ],
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

          <FileUploadTemplate config={uploadConfig} />
        </CardContent>
      </Card>
    </Box>
  );
}

