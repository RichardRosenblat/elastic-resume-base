/**
 * @file types.ts — TypeScript interfaces for the generic template components.
 *
 * These types define the configuration objects accepted by:
 *
 * - {@link FormConfig} / {@link FieldConfig} / {@link ButtonConfig} — for
 *   {@link FormTemplate}
 * - {@link TableConfig} / {@link ColumnConfig} / {@link TableSortState} /
 *   {@link TablePaginationConfig} — for {@link TableTemplate}
 * - {@link DataDisplayConfig} / {@link DisplayFieldConfig} — for
 *   {@link DataDisplayTemplate}
 *
 * All component configs are plain object literals; render callbacks and event
 * handlers are passed as ordinary function props.
 */

import type { ReactNode, SyntheticEvent } from 'react';
import type { SortDirection } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────────────────────

/** A key–value option rendered inside a `<Select>` field. */
export interface SelectOption {
  value: string;
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for a single action button.
 *
 * Pass an array of `ButtonConfig` objects inside {@link FormConfig.buttons} to
 * render ordered action buttons in a form.
 *
 * @example
 * ```ts
 * const saveButton: ButtonConfig = {
 *   label: 'Save',
 *   onClick: handleSave,
 *   variant: 'contained',
 *   disabled: isSaving,
 * };
 * ```
 */
export interface ButtonConfig {
  /** Button label text. */
  label: string;
  /** Click handler — may be async. */
  onClick: () => void | Promise<void>;
  /** MUI Button variant (default: `'text'`). */
  variant?: 'contained' | 'outlined' | 'text';
  /** MUI Button color (default: `'primary'`). */
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'inherit';
  /** Disables the button when `true`. */
  disabled?: boolean;
  /** Optional icon displayed before the label. */
  startIcon?: ReactNode;
  /** Additional MUI `sx` prop forwarded to the `<Button>`. */
  sx?: object;
  /** HTML button `type` attribute (default: `'button'`). */
  type?: 'button' | 'submit' | 'reset';
}

// ─────────────────────────────────────────────────────────────────────────────
// Form Template
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Supported input types for a {@link FieldConfig}.
 *
 * - `'text'` / `'email'` / `'password'` / `'number'` — rendered as
 *   `<TextField>` with the corresponding `type` attribute.
 * - `'select'` — rendered as a MUI `<Select>` with {@link SelectOption} items.
 */
export type FieldType = 'text' | 'email' | 'password' | 'number' | 'select';

/**
 * Configuration for a single form field.
 *
 * Fields are rendered in the order they appear in the
 * {@link FormConfig.fields} array.
 *
 * @example
 * ```ts
 * const emailField: FieldConfig = {
 *   key: 'email',
 *   label: 'Email',
 *   type: 'email',
 *   size: 'small',
 *   minWidth: 280,
 * };
 *
 * const roleField: FieldConfig = {
 *   key: 'role',
 *   label: 'Role',
 *   type: 'select',
 *   options: [
 *     { value: 'user', label: 'User' },
 *     { value: 'admin', label: 'Admin' },
 *   ],
 * };
 * ```
 */
export interface FieldConfig {
  /**
   * Unique key that maps this field to its value in
   * {@link FormConfig.values} and is passed to
   * {@link FormConfig.onChange} on every change.
   */
  key: string;
  /** Label displayed inside the field. */
  label: string;
  /** Input type — determines how the field is rendered. */
  type: FieldType;
  /** Available options (required when `type === 'select'`). */
  options?: SelectOption[];
  /** Marks the field as required. */
  required?: boolean;
  /** Disables user interaction when `true`. */
  disabled?: boolean;
  /** Minimum width of the field wrapper (CSS value or number for px). */
  minWidth?: number | string;
  /** MUI `size` prop (default: `'small'`). */
  size?: 'small' | 'medium';
}

/**
 * Configuration object accepted by {@link FormTemplate}.
 *
 * The component is **controlled** — `values` and `onChange` must be provided
 * by the parent.  Call-back functions (`onChange`, button `onClick`, `onSend`)
 * are plain JS functions passed through the object literal.
 *
 * @example
 * ```tsx
 * const config: FormConfig = {
 *   fields: [
 *     { key: 'email', label: 'Email', type: 'email', size: 'small', minWidth: 280 },
 *   ],
 *   buttons: [
 *     { label: 'Save', onClick: handleSave, variant: 'contained' },
 *   ],
 *   values: { email },
 *   onChange: (key, value) => setEmail(value),
 * };
 * ```
 */
export interface FormConfig {
  /**
   * Ordered field definitions.
   * Fields are rendered **strictly** in the order they appear in this array.
   */
  fields: FieldConfig[];
  /**
   * Ordered action buttons.
   * Buttons are rendered **strictly** in the order they appear in this array.
   */
  buttons: ButtonConfig[];
  /**
   * Current form values keyed by {@link FieldConfig.key}.
   * All values are treated as strings (matching HTML input behaviour).
   */
  values: Record<string, string>;
  /**
   * Called whenever a field value changes.
   * @param key - The `FieldConfig.key` of the changed field.
   * @param value - The new string value.
   */
  onChange: (key: string, value: string) => void;
  /**
   * Optional submit handler invoked when the form is submitted (e.g., via a
   * `type="submit"` button).  If omitted, form submission is a no-op.
   */
  onSend?: (values: Record<string, string>) => void | Promise<void>;
  /**
   * Layout direction of the field + button row.
   * - `'row'` (default) — fields and buttons share a single horizontal line,
   *   wrapping on small viewports.
   * - `'column'` — fields are stacked vertically.
   */
  layout?: 'row' | 'column';
  /** Additional MUI `sx` prop forwarded to the outermost `<Box>`. */
  sx?: object;
}

// ─────────────────────────────────────────────────────────────────────────────
// Table Template
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Current sort state passed to column header render functions.
 *
 * Columns receive this object when their `header` prop is a function, allowing
 * them to render `<TableSortLabel>` with the correct `active`/`direction`
 * state.
 */
export interface TableSortState {
  /** Field currently used for sorting. */
  sortBy: string;
  /** Sort direction. */
  sortDirection: SortDirection;
  /**
   * Called by a column header to request a sort change.
   * @param field - The field key to sort by.
   */
  onSort: (field: string) => void;
}

/** Pagination configuration for {@link TableConfig}. */
export interface TablePaginationConfig {
  /** Total number of items (used to compute page count). */
  total: number;
  /** Zero-based current page index. */
  page: number;
  /** Number of rows per page. */
  rowsPerPage: number;
  /**
   * Called when the user navigates to a different page.
   * @param page - Zero-based page index.
   */
  onPageChange: (page: number) => void;
  /**
   * Called when the user changes rows-per-page.
   * @param rowsPerPage - New rows-per-page value.
   */
  onRowsPerPageChange: (rowsPerPage: number) => void;
  /** Label shown beside the rows-per-page selector. */
  rowsPerPageLabel?: string;
}

/**
 * Configuration for a single table column.
 *
 * Columns are rendered in the order they appear in {@link TableConfig.columns}.
 *
 * @template TRow - Shape of a single row's data.
 *
 * @example
 * ```tsx
 * const nameColumn: ColumnConfig<User> = {
 *   id: 'name',
 *   header: (sort) => (
 *     <TableSortLabel
 *       active={sort.sortBy === 'name'}
 *       direction={sort.sortBy === 'name' ? sort.sortDirection : 'asc'}
 *       onClick={() => sort.onSort('name')}
 *     >
 *       Name
 *     </TableSortLabel>
 *   ),
 *   cell: (row) => row.name,
 * };
 * ```
 */
export interface ColumnConfig<TRow> {
  /** Unique column identifier (used as React key). */
  id: string;
  /**
   * Column header content.
   *
   * - Pass a `ReactNode` for a static header (plain string, or any JSX).
   * - Pass a render function `(sort: TableSortState) => ReactNode` to
   *   access the current sort state and render `<TableSortLabel>` or
   *   filter chips.
   *
   * The render function is only called when {@link TableConfig.sort} is
   * provided; when `sort` is absent the function receives a no-op state.
   */
  header: ReactNode | ((sortState: TableSortState) => ReactNode);
  /**
   * Renders the cell content for a given row.
   * @param row - Full row data object.
   */
  cell: (row: TRow) => ReactNode;
  /** Optional column width forwarded to `<TableCell>`. */
  width?: string | number;
}

/**
 * Configuration object accepted by {@link TableTemplate}.
 *
 * @template TRow - Shape of a single row's data.
 *
 * @example
 * ```tsx
 * const config: TableConfig<User> = {
 *   columns: [nameColumn, roleColumn, actionsColumn],
 *   rows: users,
 *   getRowKey: (u) => u.uid,
 *   sort: { sortBy, sortDirection, onSort: handleSort },
 *   pagination: { total, page, rowsPerPage, onPageChange, onRowsPerPageChange },
 *   emptyMessage: 'No users found',
 * };
 * ```
 */
export interface TableConfig<TRow> {
  /**
   * Ordered column definitions.
   * Columns are rendered **strictly** in the order they appear in this array.
   */
  columns: ColumnConfig<TRow>[];
  /** Data rows to display. */
  rows: TRow[];
  /**
   * Returns a unique React key for each row.
   * @param row - Row data.
   */
  getRowKey: (row: TRow) => string;
  /**
   * Sort state and change handler.
   * Omit for unsortable tables.
   */
  sort?: TableSortState;
  /**
   * Pagination config.
   * Omit for unpaginated tables.
   */
  pagination?: TablePaginationConfig;
  /** Text shown when `rows` is empty (default: `'No data found'`). */
  emptyMessage?: string;
  /** MUI Table `size` prop (default: `'medium'`). */
  size?: 'small' | 'medium';
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Display Template
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for a single display field.
 *
 * @template TData - Shape of the data object being displayed.
 *
 * @example
 * ```ts
 * const emailField: DisplayFieldConfig<UserProfile> = {
 *   key: 'email',
 *   label: 'Email',
 * };
 *
 * const statusField: DisplayFieldConfig<UserProfile> = {
 *   key: 'enable',
 *   label: 'Status',
 *   render: (value) => (
 *     <Chip label={value ? 'Active' : 'Pending'} color={value ? 'success' : 'warning'} size="small" />
 *   ),
 * };
 * ```
 */
export interface DisplayFieldConfig<TData = Record<string, unknown>> {
  /**
   * Key used to look up the value in the {@link DataDisplayConfig.data}
   * object.  Must be a valid key of `TData`.
   */
  key: keyof TData & string;
  /** Human-readable label shown to the left of the value. */
  label: string;
  /**
   * Optional custom render function for the field value.
   *
   * When omitted the value is rendered as `String(data[key] ?? '-')`.
   *
   * @param value - `data[key]` (raw value from the data object).
   * @param data - Full data object (useful for composite render logic).
   */
  render?: (value: TData[keyof TData], data: TData) => ReactNode;
  /**
   * Minimum width of the label column (CSS value or number for px).
   * Defaults to `56`.
   */
  labelMinWidth?: number | string;
}

/**
 * Configuration object accepted by {@link DataDisplayTemplate}.
 *
 * @template TData - Shape of the data object being displayed.
 *
 * @example
 * ```tsx
 * const config: DataDisplayConfig<UserProfile> = {
 *   fields: [
 *     { key: 'email', label: 'Email' },
 *     { key: 'role', label: 'Role' },
 *     { key: 'uid', label: 'UID' },
 *   ],
 *   data: userProfile,
 *   title: 'Your Profile',
 * };
 * ```
 */
export interface DataDisplayConfig<TData = Record<string, unknown>> {
  /**
   * Ordered field definitions.
   * Fields are rendered **strictly** in the order they appear in this array.
   */
  fields: DisplayFieldConfig<TData>[];
  /** The data object to display. */
  data: TData;
  /**
   * Optional section title rendered above the fields.
   * When omitted no title is shown.
   */
  title?: string;
}

// Re-export SyntheticEvent so consumers don't need to import from React directly
export type { SyntheticEvent };
