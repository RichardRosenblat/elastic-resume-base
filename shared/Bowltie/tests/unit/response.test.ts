import { formatSuccess, formatError } from '../../src/response.js';

describe('response formatting utilities', () => {
  describe('formatSuccess', () => {
    it('returns success:true with the provided data', () => {
      const result = formatSuccess({ id: '123', name: 'Alice' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '123', name: 'Alice' });
    });

    it('includes a timestamp in ISO-8601 format', () => {
      const result = formatSuccess(null);
      expect(() => new Date(result.meta.timestamp)).not.toThrow();
      expect(result.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('includes correlationId when supplied', () => {
      const result = formatSuccess({}, 'req-abc');
      expect(result.meta.correlationId).toBe('req-abc');
    });

    it('omits correlationId when not supplied', () => {
      const result = formatSuccess({});
      expect(result.meta.correlationId).toBeUndefined();
    });
  });

  describe('formatError', () => {
    it('returns success:false with the provided code and message', () => {
      const result = formatError('NOT_FOUND', 'User not found');
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.message).toBe('User not found');
    });

    it('includes a timestamp in ISO-8601 format', () => {
      const result = formatError('ERR', 'Something went wrong');
      expect(result.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('includes correlationId when supplied', () => {
      const result = formatError('ERR', 'msg', 'corr-xyz');
      expect(result.meta.correlationId).toBe('corr-xyz');
    });

    it('omits correlationId when not supplied', () => {
      const result = formatError('ERR', 'msg');
      expect(result.meta.correlationId).toBeUndefined();
    });
  });
});
