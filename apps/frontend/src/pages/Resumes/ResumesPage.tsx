/**
 * @file ResumesPage.tsx — Resume ingestion page (admin function).
 *
 * Provides the resume ingest workflow (admin function) with four ingest modes:
 *  - Spreadsheet (Google Sheets ID or URL)
 *  - Excel / CSV file upload
 *  - Single Google Drive link
 *  - Single PDF or DOCX file upload
 *
 * Generate (user function) has moved to SearchPage.
 */
import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import {
  triggerResumeIngest,
  triggerResumeIngestUpload,
  triggerResumeIngestDriveLink,
  triggerResumeIngestSingleFile,
} from '../../services/api';
import { useShowApiError } from '../../hooks/useShowApiError';
import { useToast } from '../../contexts/use-toast';
import { FormTemplate, FileUploadTemplate } from '../../components/templates';

/** Ingest mode tab indices. */
const INGEST_TAB_SPREADSHEET = 0;
const INGEST_TAB_EXCEL = 1;
const INGEST_TAB_DRIVE_LINK = 2;
const INGEST_TAB_FILE = 3;

export default function ResumesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const showApiError = useShowApiError();
  const features = useFeatureFlags();

  // ── Ingest tab state ──────────────────────────────────────────────────────
  const [ingestTab, setIngestTab] = useState(INGEST_TAB_SPREADSHEET);

  // Spreadsheet tab
  const [spreadsheetValues, setSpreadsheetValues] = useState<Record<string, string>>({ sheetIdOrUrl: '' });
  const [spreadsheetLoading, setSpreadsheetLoading] = useState(false);
  const [spreadsheetSuccess, setSpreadsheetSuccess] = useState<string | null>(null);
  const [spreadsheetErrors, setSpreadsheetErrors] = useState<Array<{ row: number; error: string }>>([]);

  // Excel / CSV file tab
  const [excelFiles, setExcelFiles] = useState<File[]>([]);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelSuccess, setExcelSuccess] = useState<string | null>(null);
  const [excelErrors, setExcelErrors] = useState<Array<{ row: number; error: string }>>([]);

  // Drive link tab
  const [driveLinkValues, setDriveLinkValues] = useState<Record<string, string>>({ driveLink: '' });
  const [driveLinkLoading, setDriveLinkLoading] = useState(false);
  const [driveLinkSuccess, setDriveLinkSuccess] = useState<string | null>(null);

  // Single file tab
  const [singleFiles, setSingleFiles] = useState<File[]>([]);
  const [singleFileLoading, setSingleFileLoading] = useState(false);
  const [singleFileSuccess, setSingleFileSuccess] = useState<string | null>(null);

  // ── Ingest handlers ───────────────────────────────────────────────────────

  /** Determines whether the raw input looks like a URL or a bare sheet ID. */
  function buildSpreadsheetPayload(rawValue: string) {
    if (rawValue.startsWith('http://') || rawValue.startsWith('https://')) {
      return { sheetUrl: rawValue };
    }
    return { sheetId: rawValue };
  }

  const handleIngestSpreadsheet = async () => {
    setSpreadsheetLoading(true);
    setSpreadsheetSuccess(null);
    setSpreadsheetErrors([]);
    try {
      const payload = buildSpreadsheetPayload(spreadsheetValues.sheetIdOrUrl ?? '');
      const job = await triggerResumeIngest(payload);
      const errPart = job.errors.length > 0
        ? ` (${t('resumes.errorsCount', { count: job.errors.length })})`
        : '';
      const msg = t('resumes.ingestedCount', { count: job.ingested }) + errPart;
      setSpreadsheetSuccess(msg);
      setSpreadsheetErrors(job.errors);
      showToast(msg, { severity: 'success' });
    } catch (error) {
      showApiError(error, t('common.error'));
    } finally {
      setSpreadsheetLoading(false);
    }
  };

  const handleIngestExcel = async () => {
    if (!excelFiles[0]) return;
    setExcelLoading(true);
    setExcelSuccess(null);
    setExcelErrors([]);
    try {
      const result = await triggerResumeIngestUpload(excelFiles[0]);
      const errPart = result.errors.length > 0
        ? ` (${t('resumes.errorsCount', { count: result.errors.length })})`
        : '';
      const msg = t('resumes.ingestedCount', { count: result.ingested }) + errPart;
      setExcelSuccess(msg);
      setExcelErrors(result.errors);
      showToast(msg, { severity: result.errors.length > 0 ? 'warning' : 'success' });
    } catch (error) {
      showApiError(error, t('common.error'));
    } finally {
      setExcelLoading(false);
    }
  };

  const handleIngestDriveLink = async () => {
    setDriveLinkLoading(true);
    setDriveLinkSuccess(null);
    try {
      const result = await triggerResumeIngestDriveLink(driveLinkValues.driveLink ?? '');
      let msg: string;
      if (result.ingested === 1 && result.resumeId) {
        msg = `${t('resumes.resumeId')}: ${result.resumeId}`;
      } else if (result.duplicates.length > 0) {
        msg = `${t('resumes.ingestedCount', { count: 0 })} — duplicate`;
      } else {
        const errMsg = result.errors[0]?.error ?? t('common.error');
        showApiError(new Error(errMsg), t('common.error'));
        return;
      }
      setDriveLinkSuccess(msg);
      showToast(msg, { severity: 'success' });
    } catch (error) {
      showApiError(error, t('common.error'));
    } finally {
      setDriveLinkLoading(false);
    }
  };

  const handleIngestSingleFile = async () => {
    if (!singleFiles[0]) return;
    setSingleFileLoading(true);
    setSingleFileSuccess(null);
    try {
      const result = await triggerResumeIngestSingleFile(singleFiles[0]);
      let msg: string;
      if (result.ingested === 1 && result.resumeId) {
        msg = `${t('resumes.resumeId')}: ${result.resumeId}`;
      } else if (result.duplicates.length > 0) {
        msg = `${t('resumes.ingestedCount', { count: 0 })} — duplicate`;
      } else {
        const errMsg = result.errors[0]?.error ?? t('common.error');
        showApiError(new Error(errMsg), t('common.error'));
        return;
      }
      setSingleFileSuccess(msg);
      showToast(msg, { severity: 'success' });
    } catch (error) {
      showApiError(error, t('common.error'));
    } finally {
      setSingleFileLoading(false);
    }
  };

  /** Renders a table showing per-row error details after a batch ingest. */
  function renderIngestErrors(errors: Array<{ row: number; error: string }>) {
    if (errors.length === 0) return null;
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          {t('resumes.ingestErrorDetails')}
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: 80 }}>{t('resumes.ingestErrorRow')}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>{t('resumes.ingestErrorMessage')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {errors.map((entry, index) => (
                <TableRow key={index}>
                  <TableCell>{entry.row}</TableCell>
                  <TableCell>{entry.error}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 2.5 }}>{t('resumes.title')}</Typography>

      {!features.resumeIngest && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('common.featureNotAvailable')}
        </Alert>
      )}

      {/* ── Ingest card ──────────────────────────────────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <CloudUploadIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            {t('resumes.ingestResumes')}
          </Typography>
          {!features.resumeIngest && (
            <Alert severity="info" sx={{ mt: 1.5, py: 0 }}>{t('dashboard.comingSoon')}</Alert>
          )}

          <Tabs
            value={ingestTab}
            onChange={(_e, v: number) => setIngestTab(v)}
            sx={{ mb: 2 }}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label={t('resumes.spreadsheet')} disabled={!features.resumeIngest} />
            <Tab label={t('resumes.excelFile')} disabled={!features.resumeIngest} />
            <Tab label={t('resumes.driveLink')} disabled={!features.resumeIngest} />
            <Tab label={t('resumes.singleFile')} disabled={!features.resumeIngest} />
          </Tabs>

          {/* Tab 0 — Spreadsheet */}
          {ingestTab === INGEST_TAB_SPREADSHEET && (
            <>
              <FormTemplate
                config={{
                  fields: [
                    {
                      key: 'sheetIdOrUrl',
                      label: t('resumes.sheetIdOrUrl'),
                      type: 'text',
                      size: 'small',
                      minWidth: 320,
                      disabled: !features.resumeIngest,
                    },
                  ],
                  buttons: [
                    {
                      label: t('resumes.submit'),
                      onClick: () => { void handleIngestSpreadsheet(); },
                      variant: 'contained',
                      disabled: !features.resumeIngest || spreadsheetLoading || !spreadsheetValues.sheetIdOrUrl,
                      startIcon: spreadsheetLoading ? <CircularProgress size={16} /> : undefined,
                    },
                  ],
                  values: spreadsheetValues,
                  onChange: (key, value) => setSpreadsheetValues((prev) => ({ ...prev, [key]: value })),
                }}
              />
              {spreadsheetSuccess && <Alert severity="success" sx={{ mt: 2 }}>{spreadsheetSuccess}</Alert>}
              {renderIngestErrors(spreadsheetErrors)}
            </>
          )}

          {/* Tab 1 — Excel / CSV file */}
          {ingestTab === INGEST_TAB_EXCEL && (
            <>
              <FileUploadTemplate
                config={{
                  accept: '.xlsx,.xls,.csv',
                  multiple: false,
                  disabled: !features.resumeIngest,
                  loading: excelLoading,
                  files: excelFiles,
                  onFilesChange: setExcelFiles,
                  description: t('resumes.excelFileDescription'),
                  acceptedFormats: ['XLSX', 'XLS', 'CSV'],
                  showSuccess: !!excelSuccess,
                  successMessage: excelSuccess ?? undefined,
                  selectFilesLabel: t('documents.selectFiles'),
                  clearLabel: t('common.cancel'),
                  selectedFilesLabel: t('documents.selectedFiles'),
                  buttons: [
                    {
                      label: excelLoading ? t('common.loading') : t('resumes.submit'),
                      onClick: () => { void handleIngestExcel(); },
                      variant: 'contained',
                      disabled: !features.resumeIngest || excelLoading || excelFiles.length === 0,
                      startIcon: excelLoading ? <CircularProgress size={16} color="inherit" /> : undefined,
                    },
                  ],
                }}
              />
              {renderIngestErrors(excelErrors)}
            </>
          )}

          {/* Tab 2 — Single Drive link */}
          {ingestTab === INGEST_TAB_DRIVE_LINK && (
            <>
              <FormTemplate
                config={{
                  fields: [
                    {
                      key: 'driveLink',
                      label: t('resumes.driveLinkLabel'),
                      type: 'text',
                      size: 'small',
                      minWidth: 360,
                      disabled: !features.resumeIngest,
                    },
                  ],
                  buttons: [
                    {
                      label: t('resumes.submit'),
                      onClick: () => { void handleIngestDriveLink(); },
                      variant: 'contained',
                      disabled: !features.resumeIngest || driveLinkLoading || !driveLinkValues.driveLink,
                      startIcon: driveLinkLoading ? <CircularProgress size={16} /> : undefined,
                    },
                  ],
                  values: driveLinkValues,
                  onChange: (key, value) => setDriveLinkValues((prev) => ({ ...prev, [key]: value })),
                }}
              />
              {driveLinkSuccess && <Alert severity="success" sx={{ mt: 2 }}>{driveLinkSuccess}</Alert>}
            </>
          )}

          {/* Tab 3 — Single PDF / DOCX file */}
          {ingestTab === INGEST_TAB_FILE && (
            <>
              <FileUploadTemplate
                config={{
                  accept: '.pdf,.docx',
                  multiple: false,
                  disabled: !features.resumeIngest,
                  loading: singleFileLoading,
                  files: singleFiles,
                  onFilesChange: setSingleFiles,
                  description: t('resumes.singleFileDescription'),
                  acceptedFormats: ['PDF', 'DOCX'],
                  showSuccess: !!singleFileSuccess,
                  successMessage: singleFileSuccess ?? undefined,
                  selectFilesLabel: t('documents.selectFiles'),
                  clearLabel: t('common.cancel'),
                  selectedFilesLabel: t('documents.selectedFiles'),
                  buttons: [
                    {
                      label: singleFileLoading ? t('common.loading') : t('resumes.submit'),
                      onClick: () => { void handleIngestSingleFile(); },
                      variant: 'contained',
                      disabled: !features.resumeIngest || singleFileLoading || singleFiles.length === 0,
                      startIcon: singleFileLoading ? <CircularProgress size={16} color="inherit" /> : undefined,
                    },
                  ],
                }}
              />
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
