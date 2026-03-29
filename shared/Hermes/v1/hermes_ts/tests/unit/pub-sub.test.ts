import {
  _resetPubSubForTesting,
  getPublisher,
  initializePubSub,
  initializePubSubFromEnv,
} from '../../src/pubsub.js';
import type { IPubSubPublisher } from '../../src/interfaces/pub-sub-publisher.js';

// ---------------------------------------------------------------------------
// Mock PubSubPublisher so we never hit the real GCP SDK in unit tests
// ---------------------------------------------------------------------------
jest.mock('../../src/services/pub-sub-publisher.js', () => ({
  PubSubPublisher: jest.fn().mockImplementation((projectId: string) => ({
    projectId,
    publish: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { PubSubPublisher } from '../../src/services/pub-sub-publisher.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function asMock<T>(fn: T) {
  return fn as jest.MockedClass<new (...args: unknown[]) => unknown>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initializePubSub', () => {
  afterEach(() => {
    _resetPubSubForTesting();
    asMock(PubSubPublisher).mockClear();
  });

  it('initialises the publisher with the supplied project ID', () => {
    initializePubSub('test-project');
    expect(PubSubPublisher).toHaveBeenCalledTimes(1);
    expect(PubSubPublisher).toHaveBeenCalledWith('test-project');
  });

  it('is idempotent — only the first call has effect', () => {
    initializePubSub('project-a');
    initializePubSub('project-b');
    expect(PubSubPublisher).toHaveBeenCalledTimes(1);
    expect(PubSubPublisher).toHaveBeenCalledWith('project-a');
  });
});

describe('initializePubSubFromEnv', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    asMock(PubSubPublisher).mockClear();
  });

  afterEach(() => {
    process.env = OLD_ENV;
    _resetPubSubForTesting();
  });

  it('reads GCP_PROJECT_ID from the environment', () => {
    process.env.GCP_PROJECT_ID = 'env-project';
    initializePubSubFromEnv();
    expect(PubSubPublisher).toHaveBeenCalledWith('env-project');
  });

  it('throws when GCP_PROJECT_ID is missing', () => {
    delete process.env.GCP_PROJECT_ID;
    expect(() => initializePubSubFromEnv()).toThrow();
  });

  it('is idempotent — only the first call has effect', () => {
    process.env.GCP_PROJECT_ID = 'env-project';
    initializePubSubFromEnv();
    initializePubSubFromEnv();
    expect(PubSubPublisher).toHaveBeenCalledTimes(1);
  });
});

describe('getPublisher', () => {
  afterEach(() => _resetPubSubForTesting());

  it('throws before initialisation', () => {
    expect(() => getPublisher()).toThrow(
      'Hermes Pub/Sub has not been initialised',
    );
  });

  it('returns the publisher after initializePubSub', () => {
    initializePubSub('my-project');
    const publisher: IPubSubPublisher = getPublisher();
    expect(publisher).toBeDefined();
    expect(typeof publisher.publish).toBe('function');
  });
});

describe('_resetPubSubForTesting', () => {
  it('makes getPublisher throw again after reset', () => {
    initializePubSub('my-project');
    _resetPubSubForTesting();
    expect(() => getPublisher()).toThrow();
  });
});
