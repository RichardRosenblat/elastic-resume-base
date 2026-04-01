import { isHarborError } from '@elastic-resume-base/harbor/server';
import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { DownstreamError, UnavailableError, ValidationError } from '../errors.js';

const client = createHttpClient(config.userApiServiceUrl);

/** Maximum body size allowed for proxied requests (10 MB). */
export const MAX_PROXY_BODY_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum allowed query string length. */
export const MAX_QUERY_STRING_LENGTH = 4096;

/**
 * Request headers that must not be forwarded to the upstream Users API.
 * Dropping these prevents host spoofing, connection-management conflicts,
 * and accidental token leakage to internal services.
 */
const EXCLUDED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',    // will be recalculated by axios
  'transfer-encoding', // chunked encoding is handled by the HTTP client
  'authorization',     // Gateway authorises via authHook; downstream trusts the internal network
  'keep-alive',
]);

/**
 * Response headers that must not be forwarded to the client.
 * Connection-level headers are per-hop and must never be forwarded by proxies.
 */
const EXCLUDED_RESPONSE_HEADERS = new Set([
  'connection',
  'transfer-encoding',
  'keep-alive',
]);

/** Structured result from a proxied Users API call. */
export interface ProxyResult {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

/**
 * Builds a filtered set of request headers safe to forward to the Users API.
 * Excluded headers (host, connection, authorization, etc.) are stripped.
 */
function buildForwardHeaders(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string | string[]> {
  const filtered: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined && !EXCLUDED_REQUEST_HEADERS.has(key.toLowerCase())) {
      filtered[key.toLowerCase()] = value;
    }
  }
  return filtered;
}

/**
 * Strips per-hop response headers that must not be forwarded to the client.
 */
function buildForwardResponseHeaders(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const filtered: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!EXCLUDED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      filtered[key.toLowerCase()] = value;
    }
  }
  return filtered;
}

/**
 * Transparently proxies an HTTP request to the Users API.
 *
 * - Validates request body size from `Content-Length` header.
 * - Forwards only safe headers (strips Authorization, host, connection, etc.).
 * - Logs the proxied request and response without sensitive data.
 * - Maps downstream server errors to Gateway error types:
 *   - 5xx response   → {@link DownstreamError} (HTTP 502)
 *   - timeout        → {@link DownstreamError} with statusCode 504
 *   - conn refused   → {@link UnavailableError} (HTTP 503)
 *
 * 4xx responses from the Users API are passed through unchanged.
 *
 * @param method       - HTTP method (GET, POST, PATCH, DELETE, …).
 * @param url          - Full request URL path including query string.
 * @param headers      - Incoming request headers (will be filtered before forwarding).
 * @param body         - Parsed request body (may be null / undefined for body-less requests).
 * @param correlationId - Correlation ID for distributed tracing.
 * @returns Structured proxy result containing status code, response headers, and body.
 *
 * @throws {ValidationError}  If the request body or query string exceeds the allowed size.
 * @throws {DownstreamError}  If the Users API returns a 5xx response or times out.
 * @throws {UnavailableError} If the Users API cannot be reached.
 */
export async function proxyToUsersApi(
  method: string,
  url: string,
  headers: Record<string, string | string[] | undefined>,
  body: unknown,
  correlationId: string,
): Promise<ProxyResult> {
  // Validate body size using the Content-Length header when present.
  const rawContentLength = headers['content-length'];
  if (rawContentLength !== undefined) {
    const contentLength = parseInt(String(rawContentLength), 10);
    if (!isNaN(contentLength) && contentLength > MAX_PROXY_BODY_SIZE_BYTES) {
      logger.warn(
        { method, url, contentLength, correlationId },
        'proxyToUsersApi: request body too large, rejecting',
      );
      throw new ValidationError(
        `Request body too large — maximum allowed size is ${MAX_PROXY_BODY_SIZE_BYTES} bytes`,
      );
    }
  }

  // Validate query string length.
  const queryStart = url.indexOf('?');
  const queryString = queryStart >= 0 ? url.slice(queryStart + 1) : '';
  if (queryString.length > MAX_QUERY_STRING_LENGTH) {
    logger.warn(
      { method, url, queryStringLength: queryString.length, correlationId },
      'proxyToUsersApi: query string too long, rejecting',
    );
    throw new ValidationError(
      `Query string too long — maximum allowed length is ${MAX_QUERY_STRING_LENGTH} characters`,
    );
  }

  const forwardHeaders = buildForwardHeaders(headers);

  logger.debug(
    { method, url, correlationId },
    'proxyToUsersApi: forwarding request to Users API',
  );

  try {
    const response = await client.request<unknown>({
      method,
      url,
      headers: forwardHeaders,
      // Only include data when there is a body to send.  Passing `undefined`
      // for GET / DELETE requests prevents axios from sending a body payload.
      data: body !== undefined && body !== null ? body : undefined,
      // Accept all HTTP status codes — we handle status mapping ourselves.
      validateStatus: () => true,
    });

    if (response.status >= 500) {
      logger.error(
        { method, url, statusCode: response.status, correlationId },
        'proxyToUsersApi: Users API returned a server error, mapping to 502',
      );
      throw new DownstreamError('Users API returned a server error');
    }

    logger.info(
      { method, url, statusCode: response.status, correlationId },
      'proxyToUsersApi: received response from Users API',
    );

    const responseHeaders = buildForwardResponseHeaders(
      response.headers as Record<string, string | string[] | undefined>,
    );

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: response.data,
    };
  } catch (err) {
    // Re-throw any error that WE threw above (i.e. DownstreamError for 5xx).
    if (!isHarborError(err)) {
      throw err;
    }

    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      logger.error(
        { method, url, correlationId },
        'proxyToUsersApi: Users API request timed out, mapping to 504',
      );
      throw new DownstreamError('Users API request timed out', 504, 'GATEWAY_TIMEOUT');
    }

    if (!err.response) {
      // No response at all — network-level error (connection refused, DNS failure, …)
      logger.error(
        { method, url, errCode: err.code, correlationId },
        'proxyToUsersApi: Users API unreachable, mapping to 503',
      );
      throw new UnavailableError('Users API is unavailable');
    }

    logger.error(
      { method, url, statusCode: err.response?.status, correlationId },
      'proxyToUsersApi: unexpected Axios error',
    );
    throw new DownstreamError('Unexpected error while proxying to Users API');
  }
}
