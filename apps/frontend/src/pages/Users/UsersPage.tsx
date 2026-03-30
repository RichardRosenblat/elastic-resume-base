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
  Divider,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { UserRecord, PreApprovedUser, UserSortField, PreApprovedSortField, SortDirection } from '../../types';
import { listUsers, updateUser, deleteUser, batchDeleteUsers, batchUpdateUsers, listPreApprovedUsers, addPreApprovedUser, deletePreApprovedUser, updatePreApprovedUser, batchDeletePreApprovedUsers, batchUpdatePreApprovedUsers } from '../../services/api';
import { useToast } from '../../contexts/use-toast';
import { useShowApiError } from '../../hooks/useShowApiError';
import { TableTemplate, FormTemplate } from '../../components/templates';
import type { ColumnConfig } from '../../components/templates';
import { useButtonLock } from '../../hooks/useButtonLock';

export default function UsersPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const showApiError = useShowApiError();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);

  // Inline user edit state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editEnabled, setEditEnabled] = useState(true);

  // User delete dialog state
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserRecord | null>(null);

  // Bulk selection state
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Bulk action dialog state
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkRoleChangeOpen, setBulkRoleChangeOpen] = useState(false);
  const [bulkRole, setBulkRole] = useState<'admin' | 'user'>('user');

  // Pre-approved users state
  const [preApproved, setPreApproved] = useState<PreApprovedUser[]>([]);
  const [preApprovedLoading, setPreApprovedLoading] = useState(true);
  const [newPreApprovedEmail, setNewPreApprovedEmail] = useState('');
  const [newPreApprovedRole, setNewPreApprovedRole] = useState<'admin' | 'user'>('user');

  // Inline pre-approved edit state
  const [editingPreApprovedEmail, setEditingPreApprovedEmail] = useState<string | null>(null);
  const [editPreApprovedRole, setEditPreApprovedRole] = useState<'admin' | 'user'>('user');

  // Pre-approved delete confirm state
  const [deleteConfirmPreApproved, setDeleteConfirmPreApproved] = useState<PreApprovedUser | null>(null);

  // Pre-approved bulk selection state
  const [selectedPreApprovedEmails, setSelectedPreApprovedEmails] = useState<Set<string>>(new Set());

  // Pre-approved bulk action dialog state
  const [bulkDeletePreApprovedOpen, setBulkDeletePreApprovedOpen] = useState(false);
  const [bulkRoleChangePreApprovedOpen, setBulkRoleChangePreApprovedOpen] = useState(false);
  const [bulkPreApprovedRole, setBulkPreApprovedRole] = useState<'admin' | 'user'>('user');

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
  const { locked: bulkDeleteLocked, wrap: wrapBulkDelete } = useButtonLock();
  const { locked: bulkRoleChangeLocked, wrap: wrapBulkRoleChange } = useButtonLock();
  const { locked: bulkDeletePreApprovedLocked, wrap: wrapBulkDeletePreApproved } = useButtonLock();
  const { locked: bulkRoleChangePreApprovedLocked, wrap: wrapBulkRoleChangePreApproved } = useButtonLock();

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
      showApiError(error, t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [
    page,
    rowsPerPage,
    showApiError,
    t,
    usersSortBy,
    usersSortDirection,
    usersRoleFilter,
    usersEnabledFilter,
  ]);

  const fetchPreApproved = useCallback(async () => {
    setPreApprovedLoading(true);
    try {
      const data = await listPreApprovedUsers({
        role: preApprovedRoleFilter === 'all' ? undefined : preApprovedRoleFilter,
        orderBy: preApprovedSortBy,
        orderDirection: preApprovedSortDirection,
      });
      setPreApproved(data);
    } catch (error) {
      showApiError(error, t('common.error'));
    } finally {
      setPreApprovedLoading(false);
    }
  }, [showApiError, t, preApprovedSortBy, preApprovedSortDirection, preApprovedRoleFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Clear selection whenever the visible rows change (page / filter / sort change)
  useEffect(() => {
    setSelectedUserIds(new Set());
  }, [page, rowsPerPage, usersRoleFilter, usersEnabledFilter, usersSortBy, usersSortDirection]);

  useEffect(() => {
    void fetchPreApproved();
  }, [fetchPreApproved]);

  // Clear pre-approved selection whenever the visible rows change (filter / sort change)
  useEffect(() => {
    setSelectedPreApprovedEmails(new Set());
  }, [preApprovedRoleFilter, preApprovedSortBy, preApprovedSortDirection]);

  // ─── User CRUD handlers ────────────────────────────────────────────────────

  const handleEditStart = (user: UserRecord) => {
    setEditingUserId(user.uid);
    setEditRole(user.role);
    setEditEnabled(user.enable);
  };

  const handleEditCancel = () => setEditingUserId(null);

  const handleEditSave = async () => {
    if (!editingUserId) return;
    try {
      const payload: Partial<UserRecord> = { role: editRole, enable: editEnabled };
      await updateUser(editingUserId, payload);
      showToast(t('users.updateSuccess'), { severity: 'success' });
      setEditingUserId(null);
      void fetchUsers();
    } catch (error) {
      showApiError(error, t('common.error'));
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
      showApiError(error, t('common.error'));
    }
  };

  const handleBulkDelete = async () => {
    try {
      await batchDeleteUsers([...selectedUserIds]);
      showToast(t('users.bulkDeleteSuccess'), { severity: 'success' });
      setSelectedUserIds(new Set());
      setBulkDeleteOpen(false);
      void fetchUsers();
    } catch (error) {
      showApiError(error, t('common.error'));
    }
  };

  const handleBulkRoleChange = async () => {
    try {
      await batchUpdateUsers([...selectedUserIds], { role: bulkRole });
      showToast(t('users.bulkRoleChangeSuccess'), { severity: 'success' });
      setSelectedUserIds(new Set());
      setBulkRoleChangeOpen(false);
      void fetchUsers();
    } catch (error) {
      showApiError(error, t('common.error'));
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
      showApiError(error, t('common.error'));
    }
  };

  const handleEditPreApprovedStart = (preApprovedUser: PreApprovedUser) => {
    setEditingPreApprovedEmail(preApprovedUser.email);
    setEditPreApprovedRole(preApprovedUser.role);
  };

  const handleEditPreApprovedCancel = () => setEditingPreApprovedEmail(null);

  const handleEditPreApprovedSave = async () => {
    if (!editingPreApprovedEmail) return;
    try {
      await updatePreApprovedUser(editingPreApprovedEmail, editPreApprovedRole);
      showToast(t('users.preApprovedUpdateSuccess'), { severity: 'success' });
      setEditingPreApprovedEmail(null);
      void fetchPreApproved();
    } catch (error) {
      showApiError(error, t('common.error'));
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
      showApiError(error, t('common.error'));
    }
  };

  const handleBulkDeletePreApproved = async () => {
    try {
      await batchDeletePreApprovedUsers([...selectedPreApprovedEmails]);
      showToast(t('users.preApprovedBulkDeleteSuccess'), { severity: 'success' });
      setSelectedPreApprovedEmails(new Set());
      setBulkDeletePreApprovedOpen(false);
      void fetchPreApproved();
    } catch (error) {
      showApiError(error, t('common.error'));
    }
  };

  const handleBulkRoleChangePreApproved = async () => {
    try {
      await batchUpdatePreApprovedUsers([...selectedPreApprovedEmails], bulkPreApprovedRole);
      showToast(t('users.preApprovedBulkRoleChangeSuccess'), { severity: 'success' });
      setSelectedPreApprovedEmails(new Set());
      setBulkRoleChangePreApprovedOpen(false);
      void fetchPreApproved();
    } catch (error) {
      showApiError(error, t('common.error'));
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
      cell: (row) =>
        editingUserId === row.uid ? (
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as 'admin' | 'user')}
            >
              <MenuItem value="user">user</MenuItem>
              <MenuItem value="admin">admin</MenuItem>
            </Select>
          </FormControl>
        ) : (
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
      cell: (row) =>
        editingUserId === row.uid ? (
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={editEnabled ? 'true' : 'false'}
              onChange={(e) => setEditEnabled(e.target.value === 'true')}
            >
              <MenuItem value="true">{t('dashboard.active')}</MenuItem>
              <MenuItem value="false">{t('dashboard.pending')}</MenuItem>
            </Select>
          </FormControl>
        ) : (
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
      cell: (row) =>
        editingUserId === row.uid ? (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={t('common.save')}>
              <IconButton
                size="small"
                color="primary"
                onClick={wrapEditSave(handleEditSave)}
                disabled={editSaveLocked}
                aria-label={t('common.save')}
              >
                <SaveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('common.cancel')}>
              <IconButton size="small" onClick={handleEditCancel} aria-label={t('common.cancel')}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ) : (
          <>
            <Tooltip title={t('users.editUserTooltip')}>
              <IconButton
                size="small"
                onClick={() => handleEditStart(row)}
                aria-label={t('users.editUserTooltip')}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('users.deleteUserTooltip')}>
              <IconButton
                size="small"
                color="error"
                onClick={() => setDeleteConfirmUser(row)}
                aria-label={t('users.deleteUserTooltip')}
              >
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
      cell: (row) =>
        editingPreApprovedEmail === row.email ? (
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={editPreApprovedRole}
              onChange={(e) => setEditPreApprovedRole(e.target.value as 'admin' | 'user')}
            >
              <MenuItem value="user">user</MenuItem>
              <MenuItem value="admin">admin</MenuItem>
            </Select>
          </FormControl>
        ) : (
          row.role
        ),
    },
    {
      id: 'actions',
      header: t('users.actions'),
      cell: (row) =>
        editingPreApprovedEmail === row.email ? (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={t('common.save')}>
              <IconButton
                size="small"
                color="primary"
                onClick={wrapEditPreApprovedSave(handleEditPreApprovedSave)}
                disabled={editPreApprovedSaveLocked}
                aria-label={t('common.save')}
              >
                <SaveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('common.cancel')}>
              <IconButton
                size="small"
                onClick={handleEditPreApprovedCancel}
                aria-label={t('common.cancel')}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ) : (
          <>
            <Tooltip title={t('users.editPreApprovedTooltip')}>
              <IconButton
                size="small"
                onClick={() => handleEditPreApprovedStart(row)}
                aria-label={t('users.editPreApprovedTooltip')}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('users.deletePreApprovedTooltip')}>
              <IconButton
                size="small"
                color="error"
                onClick={() => setDeleteConfirmPreApproved(row)}
                aria-label={t('users.deletePreApprovedTooltip')}
              >
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

      {/* ── Bulk action toolbar (visible when ≥1 user is selected) ──────────── */}
      {selectedUserIds.size > 0 && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            {t('users.selectedCount', { count: selectedUserIds.size })}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setBulkDeleteOpen(true)}
          >
            {t('users.bulkDelete')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setBulkRoleChangeOpen(true)}
          >
            {t('users.bulkChangeRole')}
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => setSelectedUserIds(new Set())}
          >
            {t('users.clearSelection')}
          </Button>
        </Stack>
      )}

      {/* ── Users table ───────────────────────────────────────────────────── */}
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
          loading,
          selection: {
            selectedKeys: selectedUserIds,
            onSelectionChange: setSelectedUserIds,
          },
        }}
      />

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
      {/* ── Pre-approved bulk action toolbar ─────────────────────────────── */}
      {selectedPreApprovedEmails.size > 0 && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            {t('users.preApprovedSelectedCount', { count: selectedPreApprovedEmails.size })}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setBulkDeletePreApprovedOpen(true)}
          >
            {t('users.preApprovedBulkDelete')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setBulkRoleChangePreApprovedOpen(true)}
          >
            {t('users.preApprovedBulkChangeRole')}
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => setSelectedPreApprovedEmails(new Set())}
          >
            {t('users.clearSelection')}
          </Button>
        </Stack>
      )}

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
          loading: preApprovedLoading,
          selection: {
            selectedKeys: selectedPreApprovedEmails,
            onSelectionChange: setSelectedPreApprovedEmails,
          },
        }}
      />

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

      {/* ── Bulk Delete Confirm Dialog ────────────────────────────────────── */}
      <Dialog open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)}>
        <DialogTitle>{t('users.bulkDelete')}</DialogTitle>
        <DialogContent>
          <Typography>{t('users.bulkDeleteConfirm', { count: selectedUserIds.size })}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={wrapBulkDelete(handleBulkDelete)} disabled={bulkDeleteLocked}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Bulk Role Change Dialog ───────────────────────────────────────── */}
      <Dialog open={bulkRoleChangeOpen} onClose={() => setBulkRoleChangeOpen(false)}>
        <DialogTitle>{t('users.bulkChangeRole')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>{t('users.bulkChangeRoleConfirm', { count: selectedUserIds.size, role: bulkRole })}</Typography>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select
              value={bulkRole}
              onChange={(e) => setBulkRole(e.target.value as 'admin' | 'user')}
            >
              <MenuItem value="user">user</MenuItem>
              <MenuItem value="admin">admin</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkRoleChangeOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={wrapBulkRoleChange(handleBulkRoleChange)} disabled={bulkRoleChangeLocked}>{t('common.confirm')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Pre-approved Bulk Delete Confirm Dialog ───────────────────────── */}
      <Dialog open={bulkDeletePreApprovedOpen} onClose={() => setBulkDeletePreApprovedOpen(false)}>
        <DialogTitle>{t('users.preApprovedBulkDelete')}</DialogTitle>
        <DialogContent>
          <Typography>{t('users.preApprovedBulkDeleteConfirm', { count: selectedPreApprovedEmails.size })}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeletePreApprovedOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={wrapBulkDeletePreApproved(handleBulkDeletePreApproved)} disabled={bulkDeletePreApprovedLocked}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Pre-approved Bulk Role Change Dialog ─────────────────────────── */}
      <Dialog open={bulkRoleChangePreApprovedOpen} onClose={() => setBulkRoleChangePreApprovedOpen(false)}>
        <DialogTitle>{t('users.preApprovedBulkChangeRole')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>{t('users.preApprovedBulkChangeRoleConfirm', { count: selectedPreApprovedEmails.size, role: bulkPreApprovedRole })}</Typography>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select
              value={bulkPreApprovedRole}
              onChange={(e) => setBulkPreApprovedRole(e.target.value as 'admin' | 'user')}
            >
              <MenuItem value="user">user</MenuItem>
              <MenuItem value="admin">admin</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkRoleChangePreApprovedOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={wrapBulkRoleChangePreApproved(handleBulkRoleChangePreApproved)} disabled={bulkRoleChangePreApprovedLocked}>{t('common.confirm')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
