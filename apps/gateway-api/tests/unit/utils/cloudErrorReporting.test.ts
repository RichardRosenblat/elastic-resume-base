/**
 * Unit tests for cloudErrorReporting utility.
 */

const mockReport = jest.fn();
const mockErrorReportingConstructor = jest.fn(() => ({ report: mockReport }));

jest.mock('@google-cloud/error-reporting', () => ({
  ErrorReporting: mockErrorReportingConstructor,
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('cloudErrorReporting', () => {
  describe('getErrorReporting in non-production', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns null when nodeEnv is test', () => {
      jest.mock('../../../src/config', () => ({
        config: { nodeEnv: 'test', gcpProjectId: 'demo' },
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('../../../src/utils/cloudErrorReporting');
      expect(mod.getErrorReporting()).toBeNull();
    });

    it('reportError does not throw in non-production', () => {
      jest.mock('../../../src/config', () => ({
        config: { nodeEnv: 'test', gcpProjectId: 'demo' },
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('../../../src/utils/cloudErrorReporting');
      expect(() => mod.reportError(new Error('test'))).not.toThrow();
      expect(mockReport).not.toHaveBeenCalled();
    });
  });
});
