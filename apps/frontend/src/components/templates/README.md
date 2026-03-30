# Generic Template Components

`frontend/src/components/templates/`

Three **config-driven** React components that replace hardcoded JSX with reusable
templates.  Each component accepts a single `config` object literal; the order of
rendered elements (fields, columns, buttons) follows the order of the arrays in
that object.

---

## Components

| Component | Config type | Description |
|-----------|-------------|-------------|
| [`FormTemplate`](#formtemplate) | `FormConfig` | Controlled form — text/email/password/number/select fields + ordered buttons |
| [`TableTemplate`](#tabletemplate) | `TableConfig<TRow>` | Sortable, paginated data table |
| [`DataDisplayTemplate`](#datadisplaytemplate) | `DataDisplayConfig<TData>` | Read-only labeled field display |

---

## Quick Start

```tsx
import {
  FormTemplate,
  TableTemplate,
  DataDisplayTemplate,
} from '../components/templates';
import type {
  FormConfig,
  TableConfig,
  ColumnConfig,
  DataDisplayConfig,
} from '../components/templates';
```

---

## FormTemplate

Renders an ordered list of fields followed by an ordered list of action buttons.
The component is **controlled** — the parent owns the values via `config.values`
and `config.onChange`.

### FormConfig

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `fields` | `FieldConfig[]` | ✅ | Ordered field definitions |
| `buttons` | `ButtonConfig[]` | ✅ | Ordered action buttons |
| `values` | `Record<string, string>` | ✅ | Current field values, keyed by `FieldConfig.key` |
| `onChange` | `(key: string, value: string) => void` | ✅ | Called on every field change |
| `onSend` | `(values: Record<string, string>) => void \| Promise<void>` | — | Called when a `type="submit"` button submits the form |
| `layout` | `'row' \| 'column'` | — | `'row'` (default) wraps fields horizontally; `'column'` stacks them |
| `sx` | `object` | — | MUI `sx` forwarded to the outer `<Box>` |

### FieldConfig

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✅ | Maps to the `values` key and is passed to `onChange` |
| `label` | `string` | ✅ | Input label |
| `type` | `'text' \| 'email' \| 'password' \| 'number' \| 'select'` | ✅ | Input type |
| `options` | `SelectOption[]` | — | Required when `type === 'select'` |
| `required` | `boolean` | — | HTML required attribute |
| `disabled` | `boolean` | — | Disables the input |
| `minWidth` | `number \| string` | — | Minimum CSS width |
| `size` | `'small' \| 'medium'` | — | MUI size (default `'small'`) |

### ButtonConfig

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | `string` | ✅ | Button text |
| `onClick` | `() => void \| Promise<void>` | ✅ | Click handler |
| `variant` | `'contained' \| 'outlined' \| 'text'` | — | MUI variant |
| `color` | MUI color | — | MUI color |
| `disabled` | `boolean` | — | |
| `startIcon` | `ReactNode` | — | Icon before label |
| `sx` | `object` | — | MUI `sx` forwarded to `<Button>` |
| `type` | `'button' \| 'submit' \| 'reset'` | — | HTML type (default `'button'`) |

### Example — inline form (row layout)

```tsx
const [email, setEmail] = useState('');
const [role, setRole] = useState('user');

<FormTemplate
  config={{
    fields: [
      { key: 'email', label: 'Email', type: 'email', size: 'small', minWidth: 280 },
      {
        key: 'role',
        label: 'Role',
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
        label: 'Add',
        onClick: handleAdd,
        variant: 'contained',
        startIcon: <AddIcon />,
        disabled: !email,
      },
    ],
    values: { email, role },
    onChange: (key, value) => {
      if (key === 'email') setEmail(value);
      if (key === 'role') setRole(value);
    },
  }}
/>
```

### Example — stacked form (column layout)

```tsx
<FormTemplate
  config={{
    layout: 'column',
    fields: [
      { key: 'name', label: 'Full Name', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'password', label: 'Password', type: 'password' },
    ],
    buttons: [
      { label: 'Submit', onClick: handleSubmit, variant: 'contained', type: 'submit' },
      { label: 'Cancel', onClick: handleCancel, variant: 'outlined' },
    ],
    values: formValues,
    onChange: handleChange,
    onSend: handleSubmit,
  }}
/>
```

---

## TableTemplate

Renders a MUI `<Table>` driven by a `TableConfig` object.  Column order follows
`config.columns`.  Column headers can be static `ReactNode`s or render functions
that receive the current `TableSortState`, allowing full control over sort labels
and filter chips without the template needing to know about them.

### TableConfig\<TRow\>

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `columns` | `ColumnConfig<TRow>[]` | ✅ | Ordered column definitions |
| `rows` | `TRow[]` | ✅ | Data rows |
| `getRowKey` | `(row: TRow) => string` | ✅ | Returns a unique React key per row |
| `sort` | `TableSortState` | — | Sort state + handler; omit for unsortable tables |
| `pagination` | `TablePaginationConfig` | — | Pagination config; omit for unpaginated tables |
| `emptyMessage` | `string` | — | Shown when `rows` is empty (default `'No data found'`) |
| `size` | `'small' \| 'medium'` | — | MUI Table size (default `'medium'`) |

### ColumnConfig\<TRow\>

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✅ | Unique column identifier (React key) |
| `header` | `ReactNode \| ((sort: TableSortState) => ReactNode)` | ✅ | Static or sortable header |
| `cell` | `(row: TRow) => ReactNode` | ✅ | Cell render function |
| `width` | `string \| number` | — | Column width forwarded to `<TableCell>` |

### TableSortState

| Prop | Type | Description |
|------|------|-------------|
| `sortBy` | `string` | Currently active sort field |
| `sortDirection` | `'asc' \| 'desc'` | Current direction |
| `onSort` | `(field: string) => void` | Called when the user clicks a column header |

### TablePaginationConfig

| Prop | Type | Description |
|------|------|-------------|
| `total` | `number` | Total items (for page count) |
| `page` | `number` | Zero-based current page |
| `rowsPerPage` | `number` | Items per page |
| `onPageChange` | `(page: number) => void` | Called when page changes |
| `onRowsPerPageChange` | `(rpp: number) => void` | Called when rows-per-page changes |
| `rowsPerPageLabel` | `string` | Label beside the selector |

### Example — sortable paginated table

```tsx
import { TableSortLabel, Chip } from '@mui/material';

interface User { uid: string; email: string; role: string; }

const columns: ColumnConfig<User>[] = [
  {
    id: 'email',
    header: (sort) => (
      <TableSortLabel
        active={sort.sortBy === 'email'}
        direction={sort.sortBy === 'email' ? sort.sortDirection : 'asc'}
        onClick={() => sort.onSort('email')}
      >
        Email
      </TableSortLabel>
    ),
    cell: (row) => row.email,
  },
  {
    id: 'role',
    header: 'Role',
    cell: (row) => (
      <Chip label={row.role} size="small" color={row.role === 'admin' ? 'primary' : 'default'} />
    ),
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: (row) => (
      <IconButton size="small" onClick={() => openEdit(row)}>
        <EditIcon fontSize="small" />
      </IconButton>
    ),
  },
];

<TableTemplate
  config={{
    columns,
    rows: users,
    getRowKey: (u) => u.uid,
    sort: { sortBy, sortDirection, onSort: handleSort },
    pagination: {
      total: totalUsers,
      page,
      rowsPerPage,
      onPageChange: setPage,
      onRowsPerPageChange: (rpp) => { setRowsPerPage(rpp); setPage(0); },
      rowsPerPageLabel: 'Rows per page',
    },
    emptyMessage: 'No users found',
  }}
/>
```

---

## DataDisplayTemplate

Renders an ordered list of labeled read-only fields.  An optional `render`
function on each field allows custom output (e.g., chips, badges, formatted
dates).

### DataDisplayConfig\<TData\>

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `fields` | `DisplayFieldConfig<TData>[]` | ✅ | Ordered field definitions |
| `data` | `TData` | ✅ | Data object to display |
| `title` | `string` | — | Optional section heading |

### DisplayFieldConfig\<TData\>

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `keyof TData & string` | ✅ | Key looked up in `data` |
| `label` | `string` | ✅ | Human-readable label |
| `render` | `(value, data) => ReactNode` | — | Custom render; falls back to `String(value ?? '-')` |
| `labelMinWidth` | `number \| string` | — | Min width of the label column (default `56`) |

### Example — user profile card

```tsx
import { Chip } from '@mui/material';

interface UserProfile { uid: string; email: string; role: string; enable: boolean; }

<DataDisplayTemplate
  config={{
    title: 'Your Profile',
    fields: [
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
      { key: 'uid', label: 'UID' },
      {
        key: 'enable',
        label: 'Status',
        render: (value) => (
          <Chip
            label={value ? 'Active' : 'Pending'}
            color={value ? 'success' : 'warning'}
            size="small"
          />
        ),
      },
    ],
    data: userProfile,
  }}
/>
```

---

## Pages that use these templates

| Page | Templates used |
|------|----------------|
| `UsersPage` | `TableTemplate` (users table, pre-approved table), `FormTemplate` (add pre-approved form) |
| `AccountPage` | `DataDisplayTemplate` (profile), `FormTemplate` (update email) |
| `DocumentsPage` | `FileUploadTemplate` (OCR file upload) |

---

## FileUploadTemplate

Renders a complete file-upload UI:

1. An optional description paragraph.
2. An optional row of accepted-format `<Chip>` badges.
3. A hidden `<input type="file">` wired to a visible "Select Files" button.
4. A configurable list of action buttons (e.g. "Process & Download").
5. An optional "Clear" text button shown when files are selected.
6. A scrollable list of the currently-selected files (name + size in KB).
7. An optional success `<Alert>`.

The component is **controlled** — the parent owns the `files` array.

### FileUploadConfig

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `accept` | `string` | ✅ | File extensions / MIME types forwarded to `<input accept>` |
| `files` | `File[]` | ✅ | Currently selected files |
| `onFilesChange` | `(files: File[]) => void` | ✅ | Called when the selection changes |
| `buttons` | `ButtonConfig[]` | ✅ | Action buttons (uses same `ButtonConfig` as `FormTemplate`) |
| `multiple` | `boolean` | — | Allow multi-file selection (default: `true`) |
| `maxFiles` | `number` | — | Max selectable files; `onFilesChange` is NOT called if exceeded |
| `disabled` | `boolean` | — | Disables the entire section |
| `loading` | `boolean` | — | Shows loading state on action buttons |
| `description` | `string` | — | Descriptive text below the title |
| `acceptedFormats` | `string[]` | — | Labels for format chips (e.g. `['PDF', 'DOCX']`) |
| `showSuccess` | `boolean` | — | Shows the success alert |
| `successMessage` | `string` | — | Text inside the success alert |
| `selectFilesLabel` | `string` | — | Label for the "Select Files" button |
| `clearLabel` | `string` | — | Label for the "Clear" text button |
| `selectedFilesLabel` | `string` | — | Summary label; `{count}` is replaced with the file count |

---

## Testing

Each template has a dedicated test file:

```
src/components/templates/
├── FormTemplate.test.tsx
├── TableTemplate.test.tsx
├── DataDisplayTemplate.test.tsx
└── FileUploadTemplate.test.tsx
```

Run all template tests:

```bash
cd frontend && npx vitest run src/components/templates
```
