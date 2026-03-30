import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TableTemplate from './TableTemplate';
import type { ColumnConfig, TableConfig, TableSortState } from './types';

// ─── test data ───────────────────────────────────────────────────────────────

interface TestRow {
  id: string;
  name: string;
  role: string;
}

const rows: TestRow[] = [
  { id: '1', name: 'Alice', role: 'admin' },
  { id: '2', name: 'Bob', role: 'user' },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function buildColumns(
  overrides?: Partial<ColumnConfig<TestRow>>[],
): ColumnConfig<TestRow>[] {
  const defaults: ColumnConfig<TestRow>[] = [
    { id: 'name', header: 'Name', cell: (r) => r.name },
    { id: 'role', header: 'Role', cell: (r) => r.role },
  ];
  return overrides ? overrides.map((o, i) => ({ ...defaults[i], ...o })) : defaults;
}

function buildConfig(overrides: Partial<TableConfig<TestRow>> = {}): TableConfig<TestRow> {
  return {
    columns: buildColumns(),
    rows,
    getRowKey: (r) => r.id,
    ...overrides,
  };
}

// ─── TableTemplate tests ─────────────────────────────────────────────────────

describe('TableTemplate', () => {
  it('renders a row for each item in config.rows', () => {
    render(<TableTemplate config={buildConfig()} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders column headers in config order', () => {
    render(<TableTemplate config={buildConfig()} />);

    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]).toHaveTextContent('Name');
    expect(headers[1]).toHaveTextContent('Role');
  });

  it('renders columns in the order they appear in config.columns', () => {
    const reversed = buildConfig({
      columns: [
        { id: 'role', header: 'Role', cell: (r) => r.role },
        { id: 'name', header: 'Name', cell: (r) => r.name },
      ],
    });
    render(<TableTemplate config={reversed} />);

    const headers = screen.getAllByRole('columnheader');
    // Role should come first when it is first in the array
    expect(headers[0]).toHaveTextContent('Role');
    expect(headers[1]).toHaveTextContent('Name');
  });

  it('shows emptyMessage when rows array is empty', () => {
    render(<TableTemplate config={buildConfig({ rows: [], emptyMessage: 'Nothing here' })} />);

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows default empty message when rows is empty and emptyMessage is omitted', () => {
    render(<TableTemplate config={buildConfig({ rows: [] })} />);

    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('calls sort.onSort with the correct field when a function header clicks', () => {
    const onSort = vi.fn();
    const sortState: TableSortState = { sortBy: 'name', sortDirection: 'asc', onSort };

    const config = buildConfig({
      columns: [
        {
          id: 'name',
          header: (s) => (
            <button type="button" onClick={() => s.onSort('name')}>
              Name
            </button>
          ),
          cell: (r) => r.name,
        },
      ],
      sort: sortState,
    });

    render(<TableTemplate config={config} />);
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));

    expect(onSort).toHaveBeenCalledWith('name');
  });

  it('renders pagination controls when pagination config is provided', () => {
    const onPageChange = vi.fn();
    const config = buildConfig({
      pagination: {
        total: 50,
        page: 0,
        rowsPerPage: 10,
        onPageChange,
        onRowsPerPageChange: vi.fn(),
        rowsPerPageLabel: 'Rows',
      },
    });
    render(<TableTemplate config={config} />);

    // MUI TablePagination renders navigation buttons
    const nextButton = screen.getByTitle('Go to next page');
    expect(nextButton).toBeInTheDocument();
  });

  it('calls onPageChange when next page is clicked', () => {
    const onPageChange = vi.fn();
    const config = buildConfig({
      rows: Array.from({ length: 20 }, (_, i) => ({
        id: String(i),
        name: `User ${i}`,
        role: 'user',
      })),
      pagination: {
        total: 20,
        page: 0,
        rowsPerPage: 10,
        onPageChange,
        onRowsPerPageChange: vi.fn(),
      },
    });
    render(<TableTemplate config={config} />);

    fireEvent.click(screen.getByTitle('Go to next page'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('renders custom cell content via cell render function', () => {
    const config = buildConfig({
      columns: [
        {
          id: 'name',
          header: 'Name',
          cell: (r) => <strong data-testid="bold-name">{r.name}</strong>,
        },
      ],
    });
    render(<TableTemplate config={config} />);

    const boldNames = screen.getAllByTestId('bold-name');
    expect(boldNames).toHaveLength(2);
    expect(boldNames[0]).toHaveTextContent('Alice');
  });

  it('uses getRowKey to set unique React keys (no duplicate key warning)', () => {
    // If duplicate keys were used React would warn — this test just verifies
    // rendering completes without errors.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<TableTemplate config={buildConfig()} />);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  // ─── selection feature ───────────────────────────────────────────────────

  it('renders a checkbox column when selection config is provided', () => {
    const config = buildConfig({
      selection: {
        selectedKeys: new Set(),
        onSelectionChange: vi.fn(),
      },
    });
    render(<TableTemplate config={config} />);

    // One header checkbox + two row checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(3);
  });

  it('header checkbox is indeterminate when some (not all) rows are selected', () => {
    const config = buildConfig({
      selection: {
        selectedKeys: new Set(['1']),
        onSelectionChange: vi.fn(),
      },
    });
    render(<TableTemplate config={config} />);

    const headerCheckbox = screen.getByRole('checkbox', { name: 'select all rows' });
    // MUI sets data-indeterminate on the input when indeterminate=true
    expect(headerCheckbox).toHaveAttribute('data-indeterminate', 'true');
  });

  it('header checkbox is checked when all rows are selected', () => {
    const config = buildConfig({
      selection: {
        selectedKeys: new Set(['1', '2']),
        onSelectionChange: vi.fn(),
      },
    });
    render(<TableTemplate config={config} />);

    const headerCheckbox = screen.getByRole('checkbox', { name: 'select all rows' });
    expect(headerCheckbox).toBeChecked();
    expect(headerCheckbox).toHaveAttribute('data-indeterminate', 'false');
  });

  it('calls onSelectionChange with all keys when header checkbox is clicked and none are selected', () => {
    const onSelectionChange = vi.fn();
    const config = buildConfig({
      selection: {
        selectedKeys: new Set(),
        onSelectionChange,
      },
    });
    render(<TableTemplate config={config} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'select all rows' }));
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['1', '2']));
  });

  it('calls onSelectionChange with empty set when header checkbox is clicked and all are selected', () => {
    const onSelectionChange = vi.fn();
    const config = buildConfig({
      selection: {
        selectedKeys: new Set(['1', '2']),
        onSelectionChange,
      },
    });
    render(<TableTemplate config={config} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'select all rows' }));
    expect(onSelectionChange).toHaveBeenCalledWith(new Set());
  });

  it('calls onSelectionChange with the toggled key when a row checkbox is clicked', () => {
    const onSelectionChange = vi.fn();
    const config = buildConfig({
      selection: {
        selectedKeys: new Set(),
        onSelectionChange,
      },
    });
    render(<TableTemplate config={config} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'select row 1' }));
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['1']));
  });

  it('removes a key from selection when its checkbox is clicked while already selected', () => {
    const onSelectionChange = vi.fn();
    const config = buildConfig({
      selection: {
        selectedKeys: new Set(['1', '2']),
        onSelectionChange,
      },
    });
    render(<TableTemplate config={config} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'select row 1' }));
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['2']));
  });

  it('does not render checkbox column when selection config is absent', () => {
    render(<TableTemplate config={buildConfig()} />);

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});
