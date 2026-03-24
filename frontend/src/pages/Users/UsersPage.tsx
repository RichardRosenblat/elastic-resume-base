/**
 * @file UsersPage.tsx — Admin-only user management page.
 *
 * Provides two sections (admin access required for all operations):
 *
 * **Users table** — paginated list of all platform users with inline
 * edit (role, email, enabled status) and delete actions. Changes are persisted
 * through the BFF Gateway and the table is refreshed automatically.
 * Rendered via {@link TableTemplate}.
 *
 * **Pre-approved users table** — manages the list of email addresses that
 * are automatically onboarded on first sign-in. Admins can add, edit and
 * remove entries.  Rendered via {@link TableTemplate}; the "add" form uses
 * {@link FormTemplate}.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
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
  TextField,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { UserRecord, PreApprovedUser, UserSortField, PreApprovedSortField, SortDirection } from '../../types';
import { listUsers, updateUser, deleteUser, listPreApprovedUsers, addPreApprovedUser, deletePreApprovedUser, updatePreApprovedUser } from '../../services/api';
import { toUserFacingErrorMessage } from '../../services/api-error';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../contexts/use-toast';
import { TableTemplate, FormTemplate } from '../../components/templates';
import type { ColumnConfig } from '../../components/templates';
import { useButtonLock } from '../../hooks/useButtonLock';

export default function UsersPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);

  // User edit dialog state
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editEnabled, setEditEnabled] = useState(true);

  // User delete dialog state
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserRecord | null>(null);

  // Pre-approved users state
  const [preApproved, setPreApproved] = useState<PreApprovedUser[]>([]);
  const [newPreApprovedEmail, setNewPreApprovedEmail] = useState('');
  const [newPreApprovedRole, setNewPreApprovedRole] = useState<'admin' | 'user'>('user');

  // Pre-approved edit dialog state
  const [editPreApproved, setEditPreApproved] = useState<PreApprovedUser | null>(null);
  const [editPreApprovedRole, setEditPreApprovedRole] = useState<'admin' | 'user'>('user');

  // Pre-approved delete confirm state
  const [deleteConfirmPreApproved, setDeleteConfirmPreApproved] = useState<PreApprovedUser | null>(null);

  // Sorting / filtering
  const [usersSortBy, setUsersSortBy] = useState<UserSortField>('email');
  const [usersSortDirection, setUsersSortDirection] = useState<SortDirection>('asc');
  const [usersRoleFilter, setUsersRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [usersEnabledFilter, setUsersEnabledFilter] = useState<'all' | 'true' | 'false'>('all');
  const [preApprovedSortBy, setPreApprovedSortBy] = useState<PreApprovedSortField>('email');
  const [preApprovedSortDirection, setPreApprovedSortDirection] = useState<SortDirection>('asc');
  const [preApprovedRoleFilter, setPreApprovedRoleFilter] = useState<'all' | 'admin' | 'user'>('all');

  // Button lock hooks
  const { locked: editSaveLocked, wrap: wrapEditSave } = useButtonLock();
  const { locked: deleteConfirmLocked, wrap: wrapDeleteConfirm } = useButtonLock();
  const { locked: editPreApprovedSaveLocked, wrap: wrapEditPreApprovedSave } = useButtonLock();
  const { locked: deletePreApprovedConfirmLocked, wrap: wrapDeletePreApprovedConfirm } = useButtonLock();

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
      showToast(toUserFacingErrorMessage(error, t('common.error')), { severity: 'error' });
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
      showToast(toUserFacingErrorMessage(error, t('common.error')), { severity: 'error' });
    }
  }, [showToast, t, preApprovedSortBy, preApprovedSortDirection, preApprovedRoleFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    void fetchPreApproved();
  }, [fetchPreApproved]);

  // ─── User CRUD handlers ────────────────────────────────────────────────────

  const handleEditOpen = (user: UserRecord) => {
    setEditUser(user);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditEnabled(user.enable);
  };

  const handleEditClose = () => setEditUser(null);

  const handleEditSave = async () => {
    if (!editUser) return;
    try {
      const payload: Partial<UserRecord> = { role: editRole, enable: editEnabled };
      if (editEmail !== editUser.email) {
        payload.email = editEmail;
      }
      await updateUser(editUser.uid, payload);
      showToast(t('users.updateSuccess'), { severity: 'success' });
      handleEditClose();
      void fetchUsers();
    } catch (error) {
      showToast(toUserFacingErrorMessage(error, t('common.error')), { severity: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmUser) return;
    try {
      await deleteUser(deleteConfirmUser.uid);
      showToast(t('users.deleteSuccess'), { severity: 'success' });
      setDeleteConfirmUser(null);
      void fetchUsers();
    } catch (error) {
      showToast(toUserFacingErrorMessage(error, t('common.error')), { severity: 'error' });
    }
  };

  // ─── Pre-approved CRUD handlers ────────────────────────────────────────────

  const handleAddPreApproved = async () => {
    if (!newPreApprovedEmail) return;
    try {
      await addPreApprovedUser({ email: newPreApprovedEmail, role: newPreApprovedRole });
      setNewPreApprovedEmail('');
      showToast(t('common.success'), { severity: 'success' });
      void fetchPreApproved();
    } catch (error) {
      showToast(toUserFacingErrorMessage(error, t('common.error')), { severity: 'error' });
    }
  };

  const handleEditPreApprovedOpen = (preApprovedUser: PreApprovedUser) => {
    setEditPreApproved(preApprovedUser);
    setEditPreApprovedRole(preApprovedUser.role);
  };

  const handleEditPreApprovedClose = () => setEditPreApproved(null);

  const handleEditPreApprovedSave = async () => {
    if (!editPreApproved) return;
    try {
      await updatePreApprovedUser(editPreApproved.email, editPreApprovedRole);
      showToast(t('users.preApprovedUpdateSuccess'), { severity: 'success' });
      handleEditPreApprovedClose();
      void fetchPreApproved();
    } catch (error) {
      showToast(toUserFacingErrorMessage(error, t('common.error')), { severity: 'error' });
    }
  };

  const handleDeletePreApprovedConfirm = async () => {
    if (!deleteConfirmPreApproved) return;
    try {
      await deletePreApprovedUser(deleteConfirmPreApproved.email);
      showToast(t('common.success'), { severity: 'success' });
      setDeleteConfirmPreApproved(null);
      void fetchPreApproved();
    } catch (error) {
      showToast(toUserFacingErrorMessage(error, t('common.error')), { severity: 'error' });
    }
  };

  // ─── Column definitions ────────────────────────────────────────────────────

  /**
   * Column definitions for the users table.
   * The order of this array determines the order of rendered columns.
   */
  const usersColumns: ColumnConfig<UserRecord>[] = [
    {
      id: 'email',
      header: (sort) => (
        <TableSortLabel
          active={sort.sortBy === 'email'}
          direction={sort.sortBy === 'email' ? sort.sortDirection : 'asc'}
          onClick={() => sort.onSort('email')}
        >
          {t('users.email')}
        </TableSortLabel>
      ),
      cell: (row) => row.email,
    },
    {
      id: 'uid',
      header: (sort) => (
        <TableSortLabel
          active={sort.sortBy === 'uid'}
          direction={sort.sortBy === 'uid' ? sort.sortDirection : 'asc'}
          onClick={() => sort.onSort('uid')}
        >
          {t('users.uid')}
        </TableSortLabel>
      ),
      cell: (row) => row.uid,
    },
    {
      id: 'role',
      header: (sort) => (
        <Box display="flex" alignItems="center" gap={1}>
          <TableSortLabel
            active={sort.sortBy === 'role'}
            direction={sort.sortBy === 'role' ? sort.sortDirection : 'asc'}
            onClick={() => sort.onSort('role')}
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
      ),
      cell: (row) => (
        <Chip
          label={row.role}
          size="small"
          color={row.role === 'admin' ? 'primary' : 'default'}
          variant="outlined"
        />
      ),
    },
    {
      id: 'enable',
      header: (sort) => (
        <Box display="flex" alignItems="center" gap={1}>
          <TableSortLabel
            active={sort.sortBy === 'enable'}
            direction={sort.sortBy === 'enable' ? sort.sortDirection : 'asc'}
            onClick={() => sort.onSort('enable')}
          >
            {t('users.enabled')}
          </TableSortLabel>
          <Chip
            size="small"
            variant={usersEnabledFilter === 'all' ? 'outlined' : 'filled'}
            label={
              usersEnabledFilter === 'all'
                ? 'all'
                : usersEnabledFilter === 'true'
                  ? t('dashboard.active')
                  : t('dashboard.pending')
            }
            onClick={cycleUsersEnabledFilter}
          />
        </Box>
      ),
      cell: (row) => (
        <Chip
          label={row.enable ? t('dashboard.active') : t('dashboard.pending')}
          size="small"
          color={row.enable ? 'success' : 'warning'}
          variant="outlined"
        />
      ),
    },
    {
      id: 'actions',
      header: t('users.actions'),
      cell: (row) => (
        <>
          <Tooltip title={t('users.editUserTooltip')}>
            <IconButton size="small" onClick={() => handleEditOpen(row)} aria-label={t('users.editUserTooltip')}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('users.deleteUserTooltip')}>
            <IconButton size="small" color="error" onClick={() => setDeleteConfirmUser(row)} aria-label={t('users.deleteUserTooltip')}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ];

  /**
   * Column definitions for the pre-approved users table.
   * The order of this array determines the order of rendered columns.
   */
  const preApprovedColumns: ColumnConfig<PreApprovedUser>[] = [
    {
      id: 'email',
      header: (sort) => (
        <TableSortLabel
          active={sort.sortBy === 'email'}
          direction={sort.sortBy === 'email' ? sort.sortDirection : 'asc'}
          onClick={() => sort.onSort('email')}
        >
          {t('users.email')}
        </TableSortLabel>
      ),
      cell: (row) => row.email,
    },
    {
      id: 'role',
      header: (sort) => (
        <Box display="flex" alignItems="center" gap={1}>
          <TableSortLabel
            active={sort.sortBy === 'role'}
            direction={sort.sortBy === 'role' ? sort.sortDirection : 'asc'}
            onClick={() => sort.onSort('role')}
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
      ),
      cell: (row) => row.role,
    },
    {
      id: 'actions',
      header: t('users.actions'),
      cell: (row) => (
        <>
          <Tooltip title={t('users.editPreApprovedTooltip')}>
            <IconButton size="small" onClick={() => handleEditPreApprovedOpen(row)} aria-label={t('users.editPreApprovedTooltip')}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('users.deletePreApprovedTooltip')}>
            <IconButton size="small" color="error" onClick={() => setDeleteConfirmPreApproved(row)} aria-label={t('users.deletePreApprovedTooltip')}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 2.5 }}>{t('users.title')}</Typography>

      {/* ── Users table ───────────────────────────────────────────────────── */}
      {loading ? (
        <LoadingSpinner message={t('common.loading')} />
      ) : (
        <TableTemplate
          config={{
            columns: usersColumns,
            rows: users,
            getRowKey: (u) => u.uid,
            sort: {
              sortBy: usersSortBy,
              sortDirection: usersSortDirection,
              onSort: (field) => handleUsersSort(field as UserSortField),
            },
            pagination: {
              total,
              page,
              rowsPerPage,
              onPageChange: setPage,
              onRowsPerPageChange: (rpp) => { setRowsPerPage(rpp); setPage(0); },
              rowsPerPageLabel: t('common.rowsPerPage'),
            },
            emptyMessage: t('users.noUsersFound'),
          }}
        />
      )}

      <Divider sx={{ my: 4 }} />

      {/* ── Pre-approved users ────────────────────────────────────────────── */}
      <Typography variant="h6" gutterBottom>{t('users.preApprovedUsers')}</Typography>

      {/* Add pre-approved form — fields and button rendered via FormTemplate */}
      <FormTemplate
        config={{
          fields: [
            { key: 'email', label: t('users.email'), type: 'email', size: 'small', minWidth: 280 },
            {
              key: 'role',
              label: t('users.role'),
              type: 'select',
              size: 'small',
              minWidth: 150,
              options: [
                { value: 'user', label: 'user' },
                { value: 'admin', label: 'admin' },
              ],
            },
          ],
          buttons: [
            {
              label: t('users.addPreApproved'),
              onClick: () => { void handleAddPreApproved(); },
              variant: 'contained',
              startIcon: <AddIcon />,
              disabled: !newPreApprovedEmail,
              sx: { px: 2.25 },
            },
          ],
          values: { email: newPreApprovedEmail, role: newPreApprovedRole },
          onChange: (key, value) => {
            if (key === 'email') setNewPreApprovedEmail(value);
            if (key === 'role') setNewPreApprovedRole(value as 'admin' | 'user');
          },
          sx: { mb: 2 },
        }}
      />

      {/* Pre-approved table */}
      <TableTemplate
        config={{
          columns: preApprovedColumns,
          rows: preApproved,
          getRowKey: (u) => u.email,
          sort: {
            sortBy: preApprovedSortBy,
            sortDirection: preApprovedSortDirection,
            onSort: (field) => handlePreApprovedSort(field as PreApprovedSortField),
          },
          emptyMessage: t('users.noUsersFound'),
          size: 'small',
        }}
      />

      {/* ── Edit User Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!editUser} onClose={handleEditClose}>
        <DialogTitle>{t('users.editUser')}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            margin="normal"
            label={t('users.email')}
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            size="small"
          />
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
          <Button variant="contained" onClick={wrapEditSave(handleEditSave)} disabled={editSaveLocked}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete User Confirm Dialog ────────────────────────────────────── */}
      <Dialog open={!!deleteConfirmUser} onClose={() => setDeleteConfirmUser(null)}>
        <DialogTitle>{t('users.deleteUser')}</DialogTitle>
        <DialogContent>
          <Typography>{t('users.confirmDelete')}</Typography>
          <Typography variant="body2" color="text.secondary">{deleteConfirmUser?.email}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmUser(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={wrapDeleteConfirm(handleDeleteConfirm)} disabled={deleteConfirmLocked}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Pre-approved User Dialog ─────────────────────────────────── */}
      <Dialog open={!!editPreApproved} onClose={handleEditPreApprovedClose}>
        <DialogTitle>{t('users.editPreApproved')}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {editPreApproved?.email}
          </Typography>
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('users.role')}</InputLabel>
            <Select
              value={editPreApprovedRole}
              label={t('users.role')}
              onChange={(e) => setEditPreApprovedRole(e.target.value as 'admin' | 'user')}
            >
              <MenuItem value="user">user</MenuItem>
              <MenuItem value="admin">admin</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditPreApprovedClose}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={wrapEditPreApprovedSave(handleEditPreApprovedSave)} disabled={editPreApprovedSaveLocked}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Pre-approved Confirm Dialog ───────────────────────────── */}
      <Dialog open={!!deleteConfirmPreApproved} onClose={() => setDeleteConfirmPreApproved(null)}>
        <DialogTitle>{t('users.deleteUser')}</DialogTitle>
        <DialogContent>
          <Typography>{t('users.confirmDeletePreApproved')}</Typography>
          <Typography variant="body2" color="text.secondary">{deleteConfirmPreApproved?.email}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmPreApproved(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={wrapDeletePreApprovedConfirm(handleDeletePreApprovedConfirm)} disabled={deletePreApprovedConfirmLocked}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
