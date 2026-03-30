/**
 * @file DocumentsPage.tsx — Document scanner page.
 *
 * Allows authenticated users to upload one or more document files (PDF, images,
 * DOCX, or ZIP archives) to the document reader service via the BFF OCR endpoint.
 * After processing, an Excel workbook containing the extracted structured data is
 * automatically downloaded.
 *
 * Users must specify the document type for each uploaded file from a predefined
 * list of supported Brazilian document types before scanning can begin.  The
 * "Process & Download" button remains disabled until every file has an explicit
 * type selected.
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
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Typography,
} from '@mui/material';
import {
  AttachFile as AttachFileIcon,
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

/** Ordered list of Brazilian document type enum values the server supports. */
const DOCUMENT_TYPE_VALUES = [
  'RG',
  'BIRTH_CERTIFICATE',
  'MARRIAGE_CERTIFICATE',
  'WORK_CARD',
  'PIS',
  'PROOF_OF_ADDRESS',
  'PROOF_OF_EDUCATION',
] as const;

export default function DocumentsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const features = useFeatureFlags();

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  /** Per-file document type selection — index-aligned with `selectedFiles`. */
  const [documentTypeAssignments, setDocumentTypeAssignments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);

  const handleFilesChange = (files: File[]) => {
    if (files.length > MAX_FILES) {
      showToast(t('documents.tooManyFiles', { max: MAX_FILES }), { severity: 'warning' });
      return;
    }
    setSelectedFiles(files);
    // Reset type assignments when the file selection changes.
    setDocumentTypeAssignments(new Array(files.length).fill(''));
    setDownloadReady(false);
  };

  const handleDocumentTypeChange = (index: number, event: SelectChangeEvent) => {
    setDocumentTypeAssignments((prev) => {
      const next = [...prev];
      next[index] = event.target.value;
      return next;
    });
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setLoading(true);
    setDownloadReady(false);

    try {
      const blob = await ocrDocuments(selectedFiles, documentTypeAssignments);
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
    /** Hide the built-in file list so we can render our own with type selectors. */
    hideFileList: true,
    buttons: [
      {
        label: loading ? t('documents.processing') : t('documents.processAndDownload'),
        onClick: handleUpload,
        variant: 'contained',
        disabled:
          !features.documentRead ||
          loading ||
          selectedFiles.length === 0 ||
          documentTypeAssignments.some((t) => !t),
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

          {/* Per-file document type selectors — rendered below the upload controls */}
          {selectedFiles.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('documents.documentType.assignTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {t('documents.documentType.assignDescription')}
              </Typography>
              <List dense disablePadding>
                {selectedFiles.map((file, index) => (
                  <ListItem
                    key={`${file.name}-${file.size}-${index}`}
                    disableGutters
                    sx={{ gap: 2, flexWrap: 'wrap' }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <AttachFileIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={file.name}
                      secondary={`${(file.size / 1024).toFixed(1)} KB`}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                      sx={{ flexShrink: 1, minWidth: 120, maxWidth: 300 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 220 }} disabled={loading}>
                      <InputLabel id={`doc-type-label-${index}`}>
                        {t('documents.documentType.label')}
                      </InputLabel>
                      <Select
                        labelId={`doc-type-label-${index}`}
                        value={documentTypeAssignments[index] ?? ''}
                        label={t('documents.documentType.label')}
                        onChange={(e) => handleDocumentTypeChange(index, e)}
                        displayEmpty
                        renderValue={(selected) =>
                          selected
                            ? t(`documents.documentType.${selected}`)
                            : t('documents.documentType.selectType')
                        }
                      >
                        {DOCUMENT_TYPE_VALUES.map((value) => (
                          <MenuItem key={value} value={value}>
                            {t(`documents.documentType.${value}`)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
