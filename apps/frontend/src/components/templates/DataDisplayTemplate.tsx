/**
 * @file DataDisplayTemplate.tsx — Generic read-only data display component.
 *
 * Renders an ordered list of labeled fields from a data object.  Each field
 * can optionally supply a custom `render` function to produce richer output
 * (e.g., a `<Chip>` for boolean status values).
 *
 * ## Usage
 *
 * ```tsx
 * import { DataDisplayTemplate } from '../components/templates';
 * import type { DataDisplayConfig } from '../components/templates';
 *
 * interface UserProfile { uid: string; email: string; role: string; enable: boolean; }
 *
 * const config: DataDisplayConfig<UserProfile> = {
 *   fields: [
 *     { key: 'email', label: 'Email' },
 *     { key: 'role', label: 'Role' },
 *     {
 *       key: 'enable',
 *       label: 'Status',
 *       render: (val) => (
 *         <Chip label={val ? 'Active' : 'Pending'} color={val ? 'success' : 'warning'} size="small" />
 *       ),
 *     },
 *   ],
 *   data: userProfile,
 *   title: 'Your Profile',
 * };
 *
 * <DataDisplayTemplate config={config} />
 * ```
 */
import { Box, Stack, Typography } from '@mui/material';
import type { DataDisplayConfig } from './types';

/**
 * Generic read-only data display component driven by a
 * {@link DataDisplayConfig} object.
 *
 * Fields are rendered in the **exact order** they appear in
 * `config.fields`.  Each field shows a muted label on the left and the
 * (possibly custom-rendered) value on the right.
 *
 * @template TData - Shape of the data object being displayed.
 *
 * @param props.config - {@link DataDisplayConfig} describing the fields and
 *   the data to display.
 */
export default function DataDisplayTemplate<TData = Record<string, unknown>>({
  config,
}: {
  config: DataDisplayConfig<TData>;
}) {
  const { fields, data, title } = config;

  return (
    <Box>
      {title && (
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      )}
      <Stack spacing={1.25}>
        {fields.map((field) => {
          const rawValue = data[field.key as keyof TData];
          const rendered = field.render
            ? field.render(rawValue as TData[keyof TData], data)
            : String(rawValue ?? '-');

          const labelMinWidth = field.labelMinWidth ?? 56;

          return (
            <Stack key={field.key} direction="row" spacing={1} alignItems={field.render ? 'center' : 'baseline'}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ minWidth: labelMinWidth }}
              >
                {field.label}:
              </Typography>
              {field.render ? (
                <Box>{rendered}</Box>
              ) : (
                <Typography variant="body1" color="text.primary" sx={{ fontWeight: 600 }}>
                  {rendered}
                </Typography>
              )}
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}
