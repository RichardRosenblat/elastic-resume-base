import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      gap={2}
    >
      <Typography variant="h1" color="text.secondary">404</Typography>
      <Typography variant="h5">{t('common.notFound')}</Typography>
      <Button variant="contained" onClick={() => void navigate('/')}>
        {t('common.back')}
      </Button>
    </Box>
  );
}
