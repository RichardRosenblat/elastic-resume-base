/**
 * @file FormTemplate.tsx — Generic controlled form component.
 *
 * Renders an ordered list of fields (text, email, password, number, select)
 * followed by an ordered list of action buttons.  The component is fully
 * controlled: current values and the `onChange` handler must be supplied via
 * the {@link FormConfig} prop.
 *
 * ## Usage
 *
 * ```tsx
 * import { FormTemplate } from '../components/templates';
 *
 * const [email, setEmail] = useState('');
 *
 * <FormTemplate
 *   config={{
 *     fields: [
 *       { key: 'email', label: 'Email', type: 'email', size: 'small', minWidth: 280 },
 *     ],
 *     buttons: [
 *       { label: 'Save', onClick: handleSave, variant: 'contained', disabled: !email },
 *     ],
 *     values: { email },
 *     onChange: (key, value) => setEmail(value),
 *   }}
 * />
 * ```
 */
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from '@mui/material';
import type { FormConfig } from './types';

/**
 * Generic controlled form component driven by a {@link FormConfig} object.
 *
 * Fields and buttons are rendered in the **exact order** they appear in their
 * respective arrays within the config.
 *
 * @param props.config - {@link FormConfig} describing the fields, buttons,
 *   current values, and change/submit handlers.
 */
export default function FormTemplate({ config }: { config: FormConfig }) {
  const { fields, buttons, values, onChange, onSend, layout = 'row', sx } = config;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSend) void onSend(values);
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      display="flex"
      flexDirection={layout === 'column' ? 'column' : 'row'}
      gap={2}
      flexWrap={layout === 'row' ? 'wrap' : 'nowrap'}
      alignItems={layout === 'row' ? 'center' : 'stretch'}
      sx={sx}
    >
      {fields.map((field) => {
        const value = values[field.key] ?? '';

        if (field.type === 'select') {
          return (
            <FormControl
              key={field.key}
              size={field.size ?? 'small'}
              sx={{ minWidth: field.minWidth ?? 150 }}
              disabled={field.disabled}
              required={field.required}
            >
              <InputLabel>{field.label}</InputLabel>
              <Select
                value={value}
                label={field.label}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                {field.options?.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        }

        return (
          <TextField
            key={field.key}
            label={field.label}
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            type={field.type}
            size={field.size ?? 'small'}
            required={field.required}
            disabled={field.disabled}
            sx={{ minWidth: field.minWidth ?? 200 }}
          />
        );
      })}

      {buttons.map((btn, i) => (
        <Button
          key={i}
          variant={btn.variant}
          color={btn.color}
          disabled={btn.disabled}
          startIcon={btn.startIcon}
          type={btn.type ?? 'button'}
          onClick={() => { void btn.onClick(); }}
          sx={btn.sx}
        >
          {btn.label}
        </Button>
      ))}
    </Box>
  );
}
