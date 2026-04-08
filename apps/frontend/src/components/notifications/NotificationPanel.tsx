/**
 * @file NotificationPanel.tsx — DLQ notification bell and dropdown panel.
 *
 * Renders a bell icon in the application top bar.  When clicked it opens a
 * Material UI Popover listing the user's recent DLQ failure notifications
 * (and, for admins, system notifications on a separate tab).  Each item can
 * be marked as read or deleted.  When the DLQ Notifier service is unavailable
 * a degraded-mode banner is shown instead of the notification list.
 */
import { useState } from 'react';
import {
  Badge,
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Popover,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  DoneAll as DoneAllIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { NotificationRecord } from '../../types';
import type { UseNotificationsReturn } from '../../hooks/useNotifications';
import { useAuth } from '../../contexts/auth-context';

interface NotificationPanelProps {
  notifications: UseNotificationsReturn;
}

interface NotificationItemProps {
  notification: NotificationRecord;
  isSystem?: boolean;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Shared sx props for compact metadata chips. */
const CHIP_SX = { height: 18, fontSize: '0.68rem' } as const;

/**
 * A single notification list item with mark-read and delete actions.
 */
function NotificationItem({ notification, isSystem, onMarkRead, onDelete }: NotificationItemProps) {
  const { t } = useTranslation();
  const displayMessage = isSystem
    ? (notification.error ?? notification.user_message ?? t('notifications.unknownError'))
    : (notification.user_message ?? notification.error ?? t('notifications.unknownError'));

  const when = notification.created_at
    ? new Date(notification.created_at).toLocaleString()
    : '';

  return (
    <ListItem
      disablePadding
      sx={{
        px: 2,
        py: 1,
        bgcolor: notification.read ? 'transparent' : 'action.hover',
        borderLeft: notification.read ? 'none' : (theme) => `3px solid ${theme.palette.primary.main}`,
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%', gap: 1 }}>
        <ListItemText
          primary={displayMessage}
          secondary={
            <Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
              {notification.service && (
                <Chip label={notification.service} size="small" variant="outlined" sx={CHIP_SX} />
              )}
              {notification.stage && (
                <Chip label={notification.stage} size="small" variant="outlined" sx={CHIP_SX} />
              )}
              {isSystem && notification.error_type && (
                <Chip label={notification.error_type} size="small" color="error" variant="outlined" sx={CHIP_SX} />
              )}
              {when && (
                <Typography component="span" variant="caption" color="text.disabled">
                  {when}
                </Typography>
              )}
            </Box>
          }
          primaryTypographyProps={{ variant: 'body2', fontWeight: notification.read ? 400 : 600 }}
        />
        <Box sx={{ display: 'flex', flexShrink: 0, gap: 0.25 }}>
          {!notification.read && (
            <Tooltip title={t('notifications.markRead')}>
              <IconButton
                size="small"
                onClick={() => onMarkRead(notification.id)}
                aria-label={t('notifications.markRead')}
              >
                <DoneAllIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t('notifications.delete')}>
            <IconButton
              size="small"
              onClick={() => onDelete(notification.id)}
              aria-label={t('notifications.delete')}
            >
              <DeleteIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </ListItem>
  );
}

/**
 * Notification bell icon button with unread badge, plus popover panel.
 */
export default function NotificationPanel({ notifications }: NotificationPanelProps) {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [tab, setTab] = useState(0);

  const {
    notifications: userNotifs,
    systemNotifications,
    unreadCount,
    unreadSystemCount,
    serviceUnavailable,
    loading,
    refresh,
    markRead,
    remove,
  } = notifications;

  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    notifications.refresh();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const totalBadge = unreadCount + (isAdmin ? unreadSystemCount : 0);

  return (
    <>
      <Tooltip
        title={
          serviceUnavailable
            ? t('notifications.serviceUnavailable')
            : t('notifications.title')
        }
      >
        <IconButton color="inherit" onClick={handleOpen} aria-label={t('notifications.title')}>
          <Badge badgeContent={totalBadge > 0 ? totalBadge : undefined} color="error" max={99}>
            {serviceUnavailable ? (
              <NotificationsOffIcon />
            ) : (
              <NotificationsIcon />
            )}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, maxHeight: 520 } } }}
      >
        {/* Header */}
        <Box sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {t('notifications.title')}
          </Typography>
          <Tooltip title={t('notifications.refresh')}>
            <IconButton size="small" onClick={refresh} disabled={loading} aria-label={t('notifications.refresh')}>
              {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Service unavailable banner */}
        {serviceUnavailable && (
          <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
            <WarningIcon fontSize="small" />
            <Typography variant="caption">{t('notifications.serviceUnavailableBanner')}</Typography>
          </Box>
        )}

        {/* Tabs (admin only shows system tab) */}
        {isAdmin && (
          <>
            <Tabs value={tab} onChange={(_e, v) => setTab(v as number)} sx={{ px: 1, minHeight: 36 }}>
              <Tab
                label={
                  <Badge badgeContent={unreadCount || undefined} color="error" max={99}>
                    <Typography variant="caption" sx={{ pr: unreadCount ? 1.5 : 0 }}>
                      {t('notifications.myNotifications')}
                    </Typography>
                  </Badge>
                }
                sx={{ minHeight: 36, fontSize: '0.75rem' }}
              />
              <Tab
                label={
                  <Badge badgeContent={unreadSystemCount || undefined} color="error" max={99}>
                    <Typography variant="caption" sx={{ pr: unreadSystemCount ? 1.5 : 0 }}>
                      {t('notifications.systemNotifications')}
                    </Typography>
                  </Badge>
                }
                sx={{ minHeight: 36, fontSize: '0.75rem' }}
              />
            </Tabs>
            <Divider />
          </>
        )}

        {/* Notification list */}
        <Box sx={{ overflow: 'auto', maxHeight: isAdmin ? 380 : 430 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!loading && tab === 0 && (
            userNotifs.length === 0 ? (
              <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('notifications.noNotifications')}
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {userNotifs.map((n, idx) => (
                  <Box key={n.id}>
                    <NotificationItem
                      notification={n}
                      isSystem={false}
                      onMarkRead={markRead}
                      onDelete={remove}
                    />
                    {idx < userNotifs.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            )
          )}

          {!loading && tab === 1 && isAdmin && (
            systemNotifications.length === 0 ? (
              <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('notifications.noSystemNotifications')}
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {systemNotifications.map((n, idx) => (
                  <Box key={n.id}>
                    <NotificationItem
                      notification={n}
                      isSystem={true}
                      onMarkRead={markRead}
                      onDelete={remove}
                    />
                    {idx < systemNotifications.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            )
          )}
        </Box>
      </Popover>
    </>
  );
}
