import { Alert, AlertTitle } from '@mui/material';

/**
 * Props for the {@link ErrorMessage} component.
 */
interface ErrorMessageProps {
  /** Optional bold title above the message text. */
  title?: string;
  /** Human-readable error description shown to the user. */
  message: string;
  /** Called when the user dismisses the alert. If omitted the close button is hidden. */
  onClose?: () => void;
}

/**
 * Displays a dismissible MUI error `Alert` with an optional title.
 * Used throughout the application to surface API errors in a consistent style.
 */
export default function ErrorMessage({ title, message, onClose }: ErrorMessageProps) {
  return (
    <Alert severity="error" onClose={onClose} sx={{ my: 2 }}>
      {title && <AlertTitle>{title}</AlertTitle>}
      {message}
    </Alert>
  );
}
