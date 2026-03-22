import { Alert, AlertTitle } from '@mui/material';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onClose?: () => void;
}

export default function ErrorMessage({ title, message, onClose }: ErrorMessageProps) {
  return (
    <Alert severity="error" onClose={onClose} sx={{ my: 2 }}>
      {title && <AlertTitle>{title}</AlertTitle>}
      {message}
    </Alert>
  );
}
