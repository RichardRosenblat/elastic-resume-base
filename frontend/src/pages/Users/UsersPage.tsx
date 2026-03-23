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
  TableSortLabel,
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
import type { UserRecord, PreApprovedUser, UserSortField, PreApprovedSortField, SortDirection } from '../../types';
import { listUsers, updateUser, deleteUser, listPreApprovedUsers, addPreApprovedUser, deletePreApprovedUser } from '../../services/api';
import { toUserFacingErrorMessage } from '../../services/api-error';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { useToast } from '../../contexts/use-toast';

export default function UsersPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
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
  const [usersSortBy, setUsersSortBy] = useState<UserSortField>('email');
  const [usersSortDirection, setUsersSortDirection] = useState<SortDirection>('asc');
  const [usersRoleFilter, setUsersRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [usersEnabledFilter, setUsersEnabledFilter] = useState<'all' | 'true' | 'false'>('all');
  const [preApprovedSortBy, setPreApprovedSortBy] = useState<PreApprovedSortField>('email');
  const [preApprovedSortDirection, setPreApprovedSortDirection] = useState<SortDirection>('asc');
  const [preApprovedRoleFilter, setPreApprovedRoleFilter] = useState<'all' | 'admin' | 'user'>('all');

  const toggleSortDirection = (current: SortDirection): SortDirection => (current === 'asc' ? 'desc' : 'asc');

  const handleUsersSort = (field: UserSortField) => {
    if (usersSortBy === field) {
      setUsersSortDirection((prev) => toggleSortDirection(prev));
      return;
    }
    setUsersSortBy(field);
    setUsersSortDirection('asc');
  };

  const handlePreApprovedSort = (field: PreApprovedSortField) => {
    if (preApprovedSortBy === field) {
      setPreApprovedSortDirection((prev) => toggleSortDirection(prev));
      return;
    }
    setPreApprovedSortBy(field);
    setPreApprovedSortDirection('asc');
  };

  const cycleUsersRoleFilter = () => {
    setUsersRoleFilter((prev) => {
      if (prev === 'all') return 'admin';
      if (prev === 'admin') return 'user';
      return 'all';
    });
  };

  const cycleUsersEnabledFilter = () => {
    setUsersEnabledFilter((prev) => {
      if (prev === 'all') return 'true';
      if (prev === 'true') return 'false';
      return 'all';
    });
  };

  const cyclePreApprovedRoleFilter = () => {
    setPreApprovedRoleFilter((prev) => {
      if (prev === 'all') return 'admin';
      if (prev === 'admin') return 'user';
      return 'all';
    });
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listUsers(page + 1, rowsPerPage, {
        role: usersRoleFilter === 'all' ? undefined : usersRoleFilter,
        enable: usersEnabledFilter === 'all' ? undefined : usersEnabledFilter === 'true',
        orderBy: usersSortBy,
        orderDirection: usersSortDirection,
      });
      setUsers(res.data.users);
      setTotal(res.data.users.length);
    } catch (error) {
      const errorMessage = toUserFacingErrorMessage(error, t('common.error'));
      setError(errorMessage);
      showToast(errorMessage, { severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [
    page,
    rowsPerPage,
    showToast,
    t,
    usersSortBy,
    usersSortDirection,
    usersRoleFilter,
    usersEnabledFilter,
  ]);

  const fetchPreApproved = useCallback(async () => {
    try {
      const data = await listPreApprovedUsers({
        role: preApprovedRoleFilter === 'all' ? undefined : preApprovedRoleFilter,
        orderBy: preApprovedSortBy,
        orderDirection: preApprovedSortDirection,
      });
      setPreApproved(data);
    } catch (error) {
      const errorMessage = toUserFacingErrorMessage(error, t('common.error'));
      showToast(errorMessage, { severity: 'error' });
    }
  }, [showToast, t, preApprovedSortBy, preApprovedSortDirection, preApprovedRoleFilter]);

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
      const successMessage = t('users.updateSuccess');
      setSuccessMsg(successMessage);
      showToast(successMessage, { severity: 'success' });
      handleEditClose();
      void fetchUsers();
    } catch (error) {
      const errorMessage = toUserFacingErrorMessage(error, t('common.error'));
      setError(errorMessage);
      showToast(errorMessage, { severity: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmUser) return;
    try {
      await deleteUser(deleteConfirmUser.uid);
      const successMessage = t('users.deleteSuccess');
      setSuccessMsg(successMessage);
      showToast(successMessage, { severity: 'success' });
      setDeleteConfirmUser(null);
      void fetchUsers();
    } catch (error) {
      const errorMessage = toUserFacingErrorMessage(error, t('common.error'));
      setError(errorMessage);
      showToast(errorMessage, { severity: 'error' });
    }
  };

  const handleAddPreApproved = async () => {
    if (!newPreApprovedEmail) return;
    try {
      await addPreApprovedUser({ email: newPreApprovedEmail, role: newPreApprovedRole });
      setNewPreApprovedEmail('');
      showToast(t('common.success'), { severity: 'success' });
      void fetchPreApproved();
    } catch (error) {
      const errorMessage = toUserFacingErrorMessage(error, t('common.error'));
      setError(errorMessage);
      showToast(errorMessage, { severity: 'error' });
    }
  };

  const handleDeletePreApproved = async (email: string) => {
    try {
      await deletePreApprovedUser(email);
      showToast(t('common.success'), { severity: 'success' });
      void fetchPreApproved();
    } catch (error) {
      const errorMessage = toUserFacingErrorMessage(error, t('common.error'));
      setError(errorMessage);
      showToast(errorMessage, { severity: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 2.5 }}>{t('users.title')}</Typography>
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
                <TableCell>
                  <TableSortLabel
                    active={usersSortBy === 'email'}
                    direction={usersSortBy === 'email' ? usersSortDirection : 'asc'}
                    onClick={() => handleUsersSort('email')}
                  >
                    {t('users.email')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={usersSortBy === 'uid'}
                    direction={usersSortBy === 'uid' ? usersSortDirection : 'asc'}
                    onClick={() => handleUsersSort('uid')}
                  >
                    {t('users.uid')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <TableSortLabel
                      active={usersSortBy === 'role'}
                      direction={usersSortBy === 'role' ? usersSortDirection : 'asc'}
                      onClick={() => handleUsersSort('role')}
                    >
                      {t('users.role')}
                    </TableSortLabel>
                    <Chip
                      size="small"
                      variant={usersRoleFilter === 'all' ? 'outlined' : 'filled'}
                      label={usersRoleFilter === 'all' ? 'all' : usersRoleFilter}
                      onClick={cycleUsersRoleFilter}
                    />
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <TableSortLabel
                      active={usersSortBy === 'enable'}
                      direction={usersSortBy === 'enable' ? usersSortDirection : 'asc'}
                      onClick={() => handleUsersSort('enable')}
                    >
                      {t('users.enabled')}
                    </TableSortLabel>
                    <Chip
                      size="small"
                      variant={usersEnabledFilter === 'all' ? 'outlined' : 'filled'}
                      label={usersEnabledFilter === 'all'
                        ? 'all'
                        : usersEnabledFilter === 'true'
                          ? t('dashboard.active')
                          : t('dashboard.pending')}
                      onClick={cycleUsersEnabledFilter}
                    />
                  </Box>
                </TableCell>
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
                      <Chip label={user.role} size="small" color={user.role === 'admin' ? 'primary' : 'default'} variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.enable ? t('dashboard.active') : t('dashboard.pending')}
                        size="small"
                        color={user.enable ? 'success' : 'warning'}
                        variant="outlined"
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

      <Typography variant="h6" gutterBottom>{t('users.preApprovedUsers')}</Typography>
      <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
        <TextField
          label={t('users.email')}
          value={newPreApprovedEmail}
          onChange={(e) => setNewPreApprovedEmail(e.target.value)}
          size="small"
          sx={{ minWidth: 280 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
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
          sx={{ px: 2.25 }}
        >
          {t('users.addPreApproved')}
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={preApprovedSortBy === 'email'}
                  direction={preApprovedSortBy === 'email' ? preApprovedSortDirection : 'asc'}
                  onClick={() => handlePreApprovedSort('email')}
                >
                  {t('users.email')}
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  <TableSortLabel
                    active={preApprovedSortBy === 'role'}
                    direction={preApprovedSortBy === 'role' ? preApprovedSortDirection : 'asc'}
                    onClick={() => handlePreApprovedSort('role')}
                  >
                    {t('users.role')}
                  </TableSortLabel>
                  <Chip
                    size="small"
                    variant={preApprovedRoleFilter === 'all' ? 'outlined' : 'filled'}
                    label={preApprovedRoleFilter === 'all' ? 'all' : preApprovedRoleFilter}
                    onClick={cyclePreApprovedRoleFilter}
                  />
                </Box>
              </TableCell>
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
