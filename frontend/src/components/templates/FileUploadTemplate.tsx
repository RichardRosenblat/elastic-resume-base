/**
 * @file FileUploadTemplate.tsx — Generic config-driven file-upload component.
 *
 * Renders:
 * 1. An optional description paragraph.
 * 2. An optional row of accepted-format `<Chip>` badges.
 * 3. A hidden `<input type="file">` element wired to a visible "Select Files"
 *    button.
 * 4. A configurable list of action {@link ButtonConfig} buttons (e.g.
 *    "Process & Download").
 * 5. An optional "Clear" text button shown when files are selected.
 * 6. A scrollable list of the currently selected files (name + size in KB).
 * 7. An optional success `<Alert>` shown after a successful operation.
 *
 * The component is **controlled**: the parent owns the `files` array and
 * receives updates via `onFilesChange`.  All labels and copy are supplied
 * through the {@link FileUploadConfig} object so the component never contains
 * hard-coded strings and can be used across different locales.
 *
 * ## Usage
 *
 * ```tsx
 * import { FileUploadTemplate } from '../components/templates';
 * import type { FileUploadConfig } from '../components/templates';
 *
 * const config: FileUploadConfig = {
 *   accept: '.pdf,.jpg,.jpeg,.png,.tiff,.tif,.bmp,.webp,.docx,.zip',
 *   multiple: true,
 *   maxFiles: 20,
 *   disabled: !features.documentRead,
 *   loading: isProcessing,
 *   files: selectedFiles,
 *   onFilesChange: setSelectedFiles,
 *   description: 'Upload documents for OCR processing.',
 *   acceptedFormats: ['PDF', 'JPEG', 'PNG', 'TIFF', 'BMP', 'WebP', 'DOCX', 'ZIP'],
 *   showSuccess: downloadReady,
 *   successMessage: 'Your Excel file is ready and has been downloaded.',
 *   selectFilesLabel: 'Select Files',
 *   clearLabel: 'Clear',
 *   selectedFilesLabel: '{count} file(s) selected',
 *   buttons: [
 *     {
 *       label: isProcessing ? 'Processing…' : 'Process & Download',
 *       onClick: handleUpload,
 *       variant: 'contained',
 *       disabled: isProcessing || selectedFiles.length === 0,
 *       startIcon: isProcessing ? <CircularProgress size={16} color="inherit" /> : <DescriptionIcon />,
 *     },
 *   ],
 * };
 *
 * <FileUploadTemplate config={config} />
 * ```
 */
import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import {
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import type { FileUploadConfig } from './types';

/**
 * Generic config-driven file-upload component.
 *
 * All labels, accepted-format chips, action buttons, and success / error
 * state are described through the {@link FileUploadConfig} prop.  The
 * component owns only the hidden-input ref; the selected-files array is
 * managed externally and passed in as `config.files`.
 *
 * @param props.config - {@link FileUploadConfig} describing the upload UI.
 */
export default function FileUploadTemplate({ config }: { config: FileUploadConfig }) {
  const {
    accept,
    multiple = true,
    disabled = false,
    loading = false,
    files,
    onFilesChange,
    buttons,
    description,
    acceptedFormats,
    showSuccess = false,
    successMessage,
    selectFilesLabel = 'Select Files',
    clearLabel = 'Clear',
    selectedFilesLabel,
    hideFileList = false,
  } = config;

  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Set of button indices that are currently locked (i.e. their onClick is
   * in-flight or still within the minimum lock delay) — mirrors the pattern
   * used in {@link FormTemplate}.
   */
  const [lockedButtons, setLockedButtons] = useState<Set<number>>(new Set());

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    // Always propagate the selection to the parent; the parent's onFilesChange
    // is responsible for enforcing maxFiles and showing any warning toast.
    onFilesChange(selected);
  };

  const handleClear = () => {
    onFilesChange([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleButtonClick = (idx: number) => {
    const btn = buttons[idx];
    if (lockedButtons.has(idx) || btn.disabled) return;

    const lockMs = btn.lockDelayMs ?? 500;
    const startTime = Date.now();

    setLockedButtons((prev) => new Set(prev).add(idx));

    void Promise.resolve(btn.onClick()).finally(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, lockMs - elapsed);
      setTimeout(() => {
        setLockedButtons((prev) => {
          const next = new Set(prev);
          next.delete(idx);
          return next;
        });
      }, remaining);
    });
  };

  const isSelectDisabled = disabled || loading;

  const filesLabel = selectedFilesLabel
    ? selectedFilesLabel.replace('{count}', String(files.length))
    : `${files.length} file(s) selected`;

  return (
    <Box>
      {/* Description */}
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
      )}

      {/* Accepted format chips */}
      {acceptedFormats && acceptedFormats.length > 0 && (
        <Box display="flex" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
          {acceptedFormats.map((fmt) => (
            <Chip key={fmt} label={fmt} size="small" variant="outlined" />
          ))}
        </Box>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={handleInputChange}
        disabled={isSelectDisabled}
      />

      {/* Button row */}
      <Box display="flex" gap={2} flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
        {/* Select-files trigger button */}
        <Button
          variant="outlined"
          startIcon={<AttachFileIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={isSelectDisabled}
        >
          {selectFilesLabel}
        </Button>

        {/* Action buttons from config */}
        {buttons.map((btn, idx) => (
          <Button
            key={idx}
            variant={btn.variant ?? 'text'}
            color={btn.color ?? 'primary'}
            startIcon={btn.startIcon}
            disabled={btn.disabled || lockedButtons.has(idx)}
            onClick={() => handleButtonClick(idx)}
            type={btn.type ?? 'button'}
            sx={btn.sx}
          >
            {btn.label}
          </Button>
        ))}

        {/* Clear selection button — shown only when files are selected */}
        {files.length > 0 && (
          <Button variant="text" onClick={handleClear} disabled={loading}>
            {clearLabel}
          </Button>
        )}
      </Box>

      {/* Selected files list */}
      {!hideFileList && files.length > 0 && (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {filesLabel}
          </Typography>
          <List dense disablePadding>
            {files.map((file) => (
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

      {/* Success alert */}
      {showSuccess && successMessage && (
        <Alert severity="success" icon={<DownloadIcon />} sx={{ mt: 2 }}>
          {successMessage}
        </Alert>
      )}
    </Box>
  );
}

export type { FileUploadConfig };
