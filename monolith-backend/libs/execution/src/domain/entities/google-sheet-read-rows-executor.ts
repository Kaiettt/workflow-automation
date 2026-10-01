import { google } from 'googleapis';
import { INodeExecutor } from './node-executor';

export interface GoogleSheetReadRowsConfig {
  credential_id: string;
  spreadsheet_id: string;
  sheet_name: string;
}

export interface GoogleSheetsValuesResponse {
  data: {
    values?: unknown[][];
  };
}

export interface GoogleSheetsClient {
  spreadsheets: {
    values: {
      get: (params: {
        spreadsheetId: string;
        range: string;
      }) => Promise<GoogleSheetsValuesResponse>;
    };
  };
}

export type SheetsClientFactory = (
  credential: Record<string, unknown>,
) => GoogleSheetsClient;

export class GoogleSheetReadRowsExecutor implements INodeExecutor<
  GoogleSheetReadRowsConfig,
  null,
  Array<Record<string, unknown>>
> {
  readonly key = 'integration.google_sheet.readRows';

  constructor(
    private readonly sheetsClientFactory: SheetsClientFactory = (
      credential,
    ) => {
      const auth = new google.auth.OAuth2(
        process.env['google-Client-Id'],
        process.env['google-Client-secret'],
      );
      auth.setCredentials(credential);
      return google.sheets({
        version: 'v4',
        auth,
      }) as unknown as GoogleSheetsClient;
    },
  ) {}

  parseConfig(raw: unknown): GoogleSheetReadRowsConfig {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(
        'Google Sheets config must include credential_id, spreadsheet_id, and sheet_name',
      );
    }

    const config = raw as Record<string, unknown>;
    const credentialId = config.credential_id;
    const spreadsheetId = config.spreadsheet_id;
    const sheetName = config.sheet_name;

    if (typeof credentialId !== 'string' || credentialId.length === 0) {
      throw new Error('Google Sheets config.credential_id is required');
    }
    if (typeof spreadsheetId !== 'string' || spreadsheetId.length === 0) {
      throw new Error('Google Sheets config.spreadsheet_id is required');
    }
    if (typeof sheetName !== 'string' || sheetName.length === 0) {
      throw new Error('Google Sheets config.sheet_name is required');
    }

    return {
      credential_id: credentialId,
      spreadsheet_id: spreadsheetId,
      sheet_name: sheetName,
    };
  }

  parseInput(raw: unknown): null {
    if (raw !== null) {
      throw new Error('Google Sheets input must be null');
    }
    return null;
  }

  async execute(params: {
    config: GoogleSheetReadRowsConfig;
    input: null;
    credential: unknown;
  }): Promise<Array<Record<string, unknown>>> {
    if (params.input !== null) {
      throw new Error('Google Sheets input must be null');
    }

    const googleCredential = params.credential as Record<
      string,
      unknown
    > | null;
    if (!googleCredential || typeof googleCredential !== 'object') {
      throw new Error('Google Sheets credential is missing');
    }
    try {
      const sheets = this.sheetsClientFactory(googleCredential);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: params.config.spreadsheet_id,
        range: params.config.sheet_name,
      });

      const rows = response.data.values ?? [];

      if (rows.length === 0) {
        return [];
      }

      const [headerRow, ...dataRows] = rows;
      const headers = headerRow.map((header) => String(header));

      return dataRows.map((row) => {
        const item: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          item[header] = row[index] ?? '';
        });
        return item;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Google Sheets read failed';
      throw new Error(
        message.replace(
          /(access_token|refresh_token|token|Bearer [A-Za-z0-9._~+/=-]+)/gi,
          '[REDACTED]',
        ),
      );
    }
  }
}
