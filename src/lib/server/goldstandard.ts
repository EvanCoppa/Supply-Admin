import { env } from '$env/dynamic/private';
import { createSupabaseAdminClient } from '$lib/supabase.server';

const BASE_URL = (
  env['GOLDSTANDARD_API_BASE_URL'] ?? 'https://sandbox.mipaymentchoice.com/api'
).replace(/\/$/, '');
const USERNAME = env['GOLDSTANDARD_API_USERNAME'];
const PASSWORD = env['GOLDSTANDARD_API_PASSWORD'];
const MERCHANT_KEY = env['GOLDSTANDARD_MERCHANT_KEY'];

const TOKEN_TTL_MS = 25 * 60 * 1000;
let tokenCache: { token: string; fetchedAt: number } | null = null;

export class GoldStandardError extends Error {
  status: number | undefined;
  body: unknown;
  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = 'GoldStandardError';
    this.status = status;
    this.body = body;
  }
}

function requireCreds(): { username: string; password: string; merchantKey: string } {
  if (!USERNAME || !PASSWORD) {
    throw new GoldStandardError(
      'GOLDSTANDARD_API_USERNAME / GOLDSTANDARD_API_PASSWORD not set on the server.'
    );
  }
  if (!MERCHANT_KEY) {
    throw new GoldStandardError('GOLDSTANDARD_MERCHANT_KEY not set on the server.');
  }
  return { username: USERNAME, password: PASSWORD, merchantKey: MERCHANT_KEY };
}

export function getMerchantKey(): string {
  if (!MERCHANT_KEY) {
    throw new GoldStandardError('GOLDSTANDARD_MERCHANT_KEY not set on the server.');
  }
  return MERCHANT_KEY;
}

type Operation = 'authenticate' | 'tokenize' | 'bcp_sale' | 'bcp_void' | 'bcp_credit';

function maskCardNumber(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `****${digits.slice(-4)}`;
}

function maskRequestBodyForLog(operation: Operation, body: unknown): unknown {
  if (body == null || typeof body !== 'object') return body;
  const clone: Record<string, unknown> = JSON.parse(JSON.stringify(body));

  if (operation === 'authenticate') {
    if ('Password' in clone) clone['Password'] = '***';
    return clone;
  }

  if ('CardNumber' in clone) clone['CardNumber'] = maskCardNumber(clone['CardNumber']);
  const cardData = clone['CardData'];
  if (cardData && typeof cardData === 'object') {
    const cd = cardData as Record<string, unknown>;
    if ('CardNumber' in cd) cd['CardNumber'] = maskCardNumber(cd['CardNumber']);
    if ('CVV' in cd) cd['CVV'] = '***';
  }
  return clone;
}

function headersToObject(headers: HeadersInit | Headers | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

function responseHeadersToObject(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

async function writeLog(row: {
  operation: Operation;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  responseStatus: number | null;
  responseHeaders: Record<string, string> | null;
  responseBody: unknown;
  errorMessage: string | null;
  durationMs: number;
}) {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from('goldstandard_payment_logs').insert({
      merchant_key: MERCHANT_KEY,
      operation: row.operation,
      method: row.method,
      url: row.url,
      request_headers: row.requestHeaders,
      request_body: row.requestBody,
      response_status: row.responseStatus,
      response_headers: row.responseHeaders,
      response_body: row.responseBody,
      error_message: row.errorMessage,
      duration_ms: row.durationMs
    });
  } catch (err) {
    console.error('[goldstandard] failed to write payment log:', err);
  }
}

async function loggedFetch(
  operation: Operation,
  url: string,
  init: RequestInit,
  bodyForLog: unknown
): Promise<{ status: number; body: unknown; res: Response }> {
  const started = Date.now();
  const requestHeaders = headersToObject(init.headers);
  const maskedBody = maskRequestBodyForLog(operation, bodyForLog);

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    await writeLog({
      operation,
      method: (init.method ?? 'GET').toUpperCase(),
      url,
      requestHeaders,
      requestBody: maskedBody,
      responseStatus: null,
      responseHeaders: null,
      responseBody: null,
      errorMessage: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - started
    });
    throw err;
  }

  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  await writeLog({
    operation,
    method: (init.method ?? 'GET').toUpperCase(),
    url,
    requestHeaders,
    requestBody: maskedBody,
    responseStatus: res.status,
    responseHeaders: responseHeadersToObject(res),
    responseBody: body,
    errorMessage: null,
    durationMs: Date.now() - started
  });

  return { status: res.status, body, res };
}

async function authenticate(force = false): Promise<string> {
  const creds = requireCreds();
  if (!force && tokenCache && Date.now() - tokenCache.fetchedAt < TOKEN_TTL_MS) {
    return tokenCache.token;
  }

  const url = `${BASE_URL}/authenticate`;
  const authForm: Record<string, string> = {
    UserName: creds.username,
    Password: creds.password,
    MerchantId: creds.merchantKey
  };
  const authBody = new URLSearchParams(authForm);

  const { status, body } = await loggedFetch(
    'authenticate',
    url,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: authBody.toString()
    },
    authForm
  );

  if (status >= 400) throw new GoldStandardError(`GS auth failed (${status})`, status, body);

  const tokenRaw =
    body && typeof body === 'object'
      ? ((body as Record<string, unknown>)['BearerToken'] ??
        (body as Record<string, unknown>)['bearerToken'])
      : undefined;
  const token = typeof tokenRaw === 'string' ? tokenRaw : '';
  if (!token) throw new GoldStandardError('GS auth response missing BearerToken', status, body);

  tokenCache = { token, fetchedAt: Date.now() };
  return token;
}

async function authedFetch(
  operation: Operation,
  path: string,
  init: RequestInit,
  bodyForLog: unknown,
  retried = false
): Promise<{ status: number; body: unknown }> {
  const token = await authenticate();
  const url = `${BASE_URL}/${path.replace(/^\//, '')}`;
  const { status, body, res } = await loggedFetch(
    operation,
    url,
    {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    },
    bodyForLog
  );
  if (res.status === 401 && !retried) {
    tokenCache = null;
    return authedFetch(operation, path, init, bodyForLog, true);
  }
  return { status, body };
}

function detectCardType(cardNumber: string): string | undefined {
  const n = cardNumber.replace(/\D/g, '');
  if (n.startsWith('4')) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^6(?:011|5)/.test(n)) return 'Discover';
  return undefined;
}

export interface TokenizeInput {
  cardNumber: string;
  expirationDate: string;
  nameOnCard?: string;
  cardType?: string;
  streetAddress?: string;
  postalCode?: string;
}

export async function tokenizeCard(input: TokenizeInput) {
  const creds = requireCreds();
  const merchantKeyNum = Number(creds.merchantKey);
  if (!Number.isFinite(merchantKeyNum)) {
    throw new GoldStandardError('GOLDSTANDARD_MERCHANT_KEY must be numeric.');
  }

  const body: Record<string, unknown> = {
    MerchantKey: merchantKeyNum,
    CardNumber: input.cardNumber,
    ExpirationDate: input.expirationDate,
    TokenFormat: 'Uid'
  };
  const cardType = input.cardType ?? detectCardType(input.cardNumber);
  if (cardType) body['CardType'] = cardType;
  if (input.nameOnCard) body['NameOnCard'] = input.nameOnCard;
  if (input.streetAddress) body['StreetAddress'] = input.streetAddress;
  if (input.postalCode) body['PostalCode'] = input.postalCode;

  const { status, body: respBody } = await authedFetch(
    'tokenize',
    `merchants/${merchantKeyNum}/tokens/cards`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    },
    body
  );
  if (status >= 400)
    throw new GoldStandardError(`GS tokenize failed (${status})`, status, respBody);
  return respBody;
}

export interface BcpCardData {
  cardNumber?: string;
  expirationDate?: string;
  nameOnCard?: string;
  cvv?: string;
  street?: string;
  zipCode?: string;
}

export interface BcpSaleInput {
  transactionType?: string;
  cardData?: BcpCardData;
  token?: string;
  invoiceData: { invoiceNumber?: string; totalAmount: number };
  forceDuplicate?: boolean;
}

function buildBcpBody(input: BcpSaleInput) {
  const invoiceData: Record<string, unknown> = { TotalAmount: input.invoiceData.totalAmount };
  if (input.invoiceData.invoiceNumber)
    invoiceData['InvoiceNumber'] = input.invoiceData.invoiceNumber;

  const out: Record<string, unknown> = {
    TransactionType: input.transactionType ?? 'Sale',
    InvoiceData: invoiceData
  };
  if (input.token) {
    out['Token'] = input.token;
  } else if (input.cardData) {
    const cd: Record<string, unknown> = {};
    const c = input.cardData;
    if (c.cardNumber) cd['CardNumber'] = c.cardNumber;
    if (c.expirationDate) cd['ExpirationDate'] = c.expirationDate;
    if (c.nameOnCard) cd['NameOnCard'] = c.nameOnCard;
    if (c.cvv) cd['CVV'] = c.cvv;
    if (c.street) cd['Street'] = c.street;
    if (c.zipCode) cd['ZipCode'] = c.zipCode;
    out['CardData'] = cd;
  }
  if (input.forceDuplicate) out['ForceDuplicate'] = true;
  return out;
}

export async function bcpSale(input: BcpSaleInput) {
  requireCreds();
  if (!input.token && !input.cardData) {
    throw new GoldStandardError('bcpSale requires either a token or cardData.');
  }
  const requestBody = buildBcpBody(input);
  const { status, body: respBody } = await authedFetch(
    'bcp_sale',
    'v2/transactions/bcp',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    },
    requestBody
  );
  if (status >= 400)
    throw new GoldStandardError(`GS BCP sale failed (${status})`, status, respBody);
  return respBody;
}

export interface BcpTransactionResult {
  reference: string | null;
  approved: boolean;
  responseCode: string | null;
  responseMessage: string | null;
  authCode: string | null;
  raw: unknown;
}

function readString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v == null) return undefined;
  return String(v);
}

export function parseBcpResult(raw: unknown): BcpTransactionResult {
  if (!raw || typeof raw !== 'object') {
    return {
      reference: null,
      approved: false,
      responseCode: null,
      responseMessage: null,
      authCode: null,
      raw
    };
  }
  const r = raw as Record<string, unknown>;
  const reference =
    readString(r, 'TransactionId') ??
    readString(r, 'TransactionID') ??
    readString(r, 'ReferenceNumber') ??
    readString(r, 'ReferenceNum') ??
    readString(r, 'Id') ??
    null;
  const responseCode = readString(r, 'ResponseCode') ?? readString(r, 'responseCode') ?? null;
  const responseMessage =
    readString(r, 'ResponseMessage') ??
    readString(r, 'responseMessage') ??
    readString(r, 'Message') ??
    null;
  const authCode = readString(r, 'AuthCode') ?? readString(r, 'authCode') ?? null;
  const status = readString(r, 'Status') ?? '';
  const approved =
    r['Approved'] === true ||
    r['IsApproved'] === true ||
    responseCode === '00' ||
    responseCode === 'A' ||
    responseCode === 'Approved' ||
    /approved/i.test(status);
  return { reference, approved, responseCode, responseMessage, authCode, raw };
}
