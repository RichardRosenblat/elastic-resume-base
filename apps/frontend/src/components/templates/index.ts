/**
 * @module @elastic-resume-base/frontend/templates
 *
 * Generic, config-driven template components for Elastic Resume Base.
 *
 * ## Available components
 *
 * | Component | Config type | Description |
 * |-----------|-------------|-------------|
 * | {@link FormTemplate} | {@link FormConfig} | Controlled form with ordered fields and buttons |
 * | {@link TableTemplate} | {@link TableConfig} | Sortable, paginated data table |
 * | {@link DataDisplayTemplate} | {@link DataDisplayConfig} | Read-only labeled field display |
 *
 * ## Quick start
 *
 * ```tsx
 * import { FormTemplate, TableTemplate, DataDisplayTemplate } from '../components/templates';
 * import type { FormConfig, TableConfig, DataDisplayConfig, ColumnConfig } from '../components/templates';
 * ```
 *
 * See the individual component files and `README.md` for full usage examples.
 */

// Components
export { default as FormTemplate } from './FormTemplate';
export { default as TableTemplate } from './TableTemplate';
export { default as DataDisplayTemplate } from './DataDisplayTemplate';
export { default as FileUploadTemplate } from './FileUploadTemplate';

// Types — re-exported so consumers don't need deep imports
export type {
  // Shared
  SelectOption,
  // Button
  ButtonConfig,
  // Form
  FieldType,
  FieldConfig,
  FormConfig,
  // Table
  TableSortState,
  TablePaginationConfig,
  TableSelectionConfig,
  ColumnConfig,
  TableConfig,
  // Data Display
  DisplayFieldConfig,
  DataDisplayConfig,
  // File Upload
  FileUploadConfig,
} from './types';
