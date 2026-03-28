import { Box, CircularProgress, Typography } from '@mui/material';

/** Props for the {@link LoadingSpinner} component. */
interface LoadingSpinnerProps {
  /** Optional label rendered below the spinner. */
  message?: string;
}

/**
 * Centred loading indicator with an optional status message.
 * Used as a full-section placeholder while data is being fetched.
 */
export default function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="200px"
      gap={2}
    >
      <CircularProgress />
      {message && <Typography variant="body2" color="text.secondary">{message}</Typography>}
    </Box>
  );
}
