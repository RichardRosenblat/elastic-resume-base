/**
 * @file TableTemplate.tsx — Generic table component driven by a config object.
 *
 * Renders a MUI `<Table>` whose columns, rows, sorting, and pagination are all
 * described through a {@link TableConfig} object literal.  The order of
 * rendered columns follows the order of `config.columns`.
 *
 * ## Usage
 *
 * ```tsx
 * import { TableTemplate } from '../components/templates';
 * import type { ColumnConfig, TableConfig } from '../components/templates';
 *
 * interface User { uid: string; email: string; }
 *
 * const columns: ColumnConfig<User>[] = [
 *   {
 *     id: 'email',
 *     header: (sort) => (
 *       <TableSortLabel
 *         active={sort.sortBy === 'email'}
 *         direction={sort.sortBy === 'email' ? sort.sortDirection : 'asc'}
 *         onClick={() => sort.onSort('email')}
 *       >
 *         Email
 *       </TableSortLabel>
 *     ),
 *     cell: (row) => row.email,
 *   },
 * ];
 *
 * <TableTemplate
 *   config={{
 *     columns,
 *     rows: users,
 *     getRowKey: (u) => u.uid,
 *     sort: { sortBy, sortDirection, onSort: handleSort },
 *     pagination: { total, page, rowsPerPage, onPageChange, onRowsPerPageChange },
 *     emptyMessage: 'No users found',
 *   }}
 * />
 * ```
 */
import {
  Checkbox,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from '@mui/material';
import type { TableConfig, TableSortState } from './types';

/** No-op sort state used when the table has no sort config. */
const NO_SORT: TableSortState = {
  sortBy: '',
  sortDirection: 'asc',
  onSort: () => undefined,
};

/**
 * Generic table component driven by a {@link TableConfig} object.
 *
 * Columns and rows are rendered in the **exact order** they appear in the
 * config arrays.  Column headers that are render functions receive the current
 * {@link TableSortState} so they can render `<TableSortLabel>` or filter chips
 * without the template needing to know about them.
 *
 * @template TRow - Shape of a single row's data.
 *
 * @param props.config - {@link TableConfig} describing columns, rows, sorting,
 *   and pagination.
 */
export default function TableTemplate<TRow>({ config }: { config: TableConfig<TRow> }) {
  const {
    columns,
    rows,
    getRowKey,
    sort,
    pagination,
    emptyMessage = 'No data found',
    size = 'medium',
    loading = false,
    skeletonRows = 5,
    selection,
  } = config;

  const sortState: TableSortState = sort ?? NO_SORT;

  const allKeys = rows.map(getRowKey);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selection?.selectedKeys.has(k));
  const someSelected = !allSelected && allKeys.some((k) => selection?.selectedKeys.has(k));

  const handleSelectAll = () => {
    if (!selection) return;
    selection.onSelectionChange(allSelected ? new Set() : new Set(allKeys));
  };

  const handleRowSelect = (key: string) => {
    if (!selection) return;
    const next = new Set(selection.selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    selection.onSelectionChange(next);
  };

  return (
    <TableContainer component={Paper}>
      <Table size={size}>
        <TableHead>
          <TableRow>
            {selection && (
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={someSelected}
                  checked={allSelected}
                  onChange={handleSelectAll}
                  inputProps={{ 'aria-label': 'select all rows' }}
                />
              </TableCell>
            )}
            {columns.map((col) => (
              <TableCell key={col.id} width={col.width}>
                {typeof col.header === 'function'
                  ? col.header(sortState)
                  : col.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, rowIdx) => (
              <TableRow key={`skeleton-${rowIdx}`}>
                {selection && (
                  <TableCell padding="checkbox">
                    <Skeleton variant="rectangular" width={20} height={20} />
                  </TableCell>
                )}
                {columns.map((col) => (
                  <TableCell key={col.id}>
                    <Skeleton variant="text" sx={{ fontSize: '1rem' }} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (selection ? 1 : 0)} align="center">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const key = getRowKey(row);
              const isSelected = selection?.selectedKeys.has(key) ?? false;
              return (
                <TableRow key={key} selected={isSelected}>
                  {selection && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleRowSelect(key)}
                        inputProps={{ 'aria-label': `select row ${key}` }}
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell key={col.id}>{col.cell(row)}</TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {pagination && (
        <TablePagination
          component="div"
          count={pagination.total}
          page={pagination.page}
          onPageChange={(_, newPage) => pagination.onPageChange(newPage)}
          rowsPerPage={pagination.rowsPerPage}
          onRowsPerPageChange={(e) => {
            pagination.onRowsPerPageChange(parseInt(e.target.value, 10));
          }}
          labelRowsPerPage={pagination.rowsPerPageLabel}
        />
      )}
    </TableContainer>
  );
}
