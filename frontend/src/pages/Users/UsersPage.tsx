/**
 * @file UsersPage.tsx — Admin-only user management page.
 *
 * Provides two sections (admin access required for all operations):
 *
 * **Users table** — paginated list of all platform users with inline
 * edit (role, enabled status) and delete actions. Changes are persisted
 * through the BFF Gateway and the table is refreshed automatically.
 *
 * **Pre-approved users table** — manages the list of email addresses that
 * are automatically onboarded on first sign-in. Admins can add and remove
 * entries.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  TextField,
  Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { UserRecord, PreApprovedUser } from '../../types';
import { listUsers, updateUser, deleteUser, listPreApprovedUsers, addPreApprovedUser, deletePreApprovedUser } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';

export default function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserRecord | null>(null);
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editEnabled, setEditEnabled] = useState(true);
  const [preApproved, setPreApproved] = useState<PreApprovedUser[]>([]);
  const [newPreApprovedEmail, setNewPreApprovedEmail] = useState('');
  const [newPreApprovedRole, setNewPreApprovedRole] = useState<'admin' | 'user'>('user');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listUsers(page + 1, rowsPerPage);
      setUsers(res.data);
      setTotal(res.meta?.total ?? res.data.length);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, t]);

  const fetchPreApproved = useCallback(async () => {
    try {
      const data = await listPreApprovedUsers();
      setPreApproved(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    void fetchPreApproved();
  }, [fetchPreApproved]);

  const handleEditOpen = (user: UserRecord) => {
    setEditUser(user);
    setEditRole(user.role);
    setEditEnabled(user.enable);
  };

  const handleEditClose = () => setEditUser(null);

  const handleEditSave = async () => {
    if (!editUser) return;
    try {
      await updateUser(editUser.uid, { role: editRole, enable: editEnabled });
      setSuccessMsg(t('users.updateSuccess'));
      handleEditClose();
      void fetchUsers();
    } catch {
      setError(t('common.error'));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmUser) return;
    try {
      await deleteUser(deleteConfirmUser.uid);
      setSuccessMsg(t('users.deleteSuccess'));
      setDeleteConfirmUser(null);
      void fetchUsers();
    } catch {
      setError(t('common.error'));
    }
  };

  const handleAddPreApproved = async () => {
    if (!newPreApprovedEmail) return;
    try {
      await addPreApprovedUser({ email: newPreApprovedEmail, role: newPreApprovedRole });
      setNewPreApprovedEmail('');
      void fetchPreApproved();
    } catch {
      setError(t('common.error'));
    }
  };

  const handleDeletePreApproved = async (email: string) => {
    try {
      await deletePreApprovedUser(email);
      void fetchPreApproved();
    } catch {
      setError(t('common.error'));
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>{t('users.title')}</Typography>
      {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
      {successMsg && (
        <Alert severity="success" onClose={() => setSuccessMsg(null)} sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}
      {loading ? (
        <LoadingSpinner message={t('common.loading')} />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('users.email')}</TableCell>
                <TableCell>{t('users.uid')}</TableCell>
                <TableCell>{t('users.role')}</TableCell>
                <TableCell>{t('users.enabled')}</TableCell>
                <TableCell>{t('users.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">{t('users.noUsersFound')}</TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.uid}</TableCell>
                    <TableCell>
                      <Chip label={user.role} size="small" color={user.role === 'admin' ? 'primary' : 'default'} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.enable ? t('dashboard.active') : t('dashboard.pending')}
                        size="small"
                        color={user.enable ? 'success' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleEditOpen(user)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteConfirmUser(user)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            labelRowsPerPage={t('common.rowsPerPage')}
          />
        </TableContainer>
      )}

      <Divider sx={{ my: 4 }} />

      <Typography variant="h5" gutterBottom>{t('users.preApprovedUsers')}</Typography>
      <Box display="flex" gap={2} mb={2} flexWrap="wrap">
        <TextField
          label={t('users.email')}
          value={newPreApprovedEmail}
          onChange={(e) => setNewPreApprovedEmail(e.target.value)}
          size="small"
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>{t('users.role')}</InputLabel>
          <Select
            value={newPreApprovedRole}
            label={t('users.role')}
            onChange={(e) => setNewPreApprovedRole(e.target.value as 'admin' | 'user')}
          >
            <MenuItem value="user">user</MenuItem>
            <MenuItem value="admin">admin</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { void handleAddPreApproved(); }}
          disabled={!newPreApprovedEmail}
        >
          {t('users.addPreApproved')}
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('users.email')}</TableCell>
              <TableCell>{t('users.role')}</TableCell>
              <TableCell>{t('users.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {preApproved.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center">{t('users.noUsersFound')}</TableCell>
              </TableRow>
            ) : (
              preApproved.map((u) => (
                <TableRow key={u.email}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.role}</TableCell>
                  <TableCell>
                    <IconButton size="small" color="error" onClick={() => { void handleDeletePreApproved(u.email); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onClose={handleEditClose}>
        <DialogTitle>{t('users.editUser')}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" gutterBottom>{editUser?.email}</Typography>
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('users.role')}</InputLabel>
            <Select
              value={editRole}
              label={t('users.role')}
              onChange={(e) => setEditRole(e.target.value as 'admin' | 'user')}
            >
              <MenuItem value="user">user</MenuItem>
              <MenuItem value="admin">admin</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('users.enabled')}</InputLabel>
            <Select
              value={editEnabled ? 'true' : 'false'}
              label={t('users.enabled')}
              onChange={(e) => setEditEnabled(e.target.value === 'true')}
            >
              <MenuItem value="true">{t('dashboard.active')}</MenuItem>
              <MenuItem value="false">{t('dashboard.pending')}</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => { void handleEditSave(); }}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmUser} onClose={() => setDeleteConfirmUser(null)}>
        <DialogTitle>{t('users.deleteUser')}</DialogTitle>
        <DialogContent>
          <Typography>{t('users.confirmDelete')}</Typography>
          <Typography variant="body2" color="text.secondary">{deleteConfirmUser?.email}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmUser(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={() => { void handleDeleteConfirm(); }}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
