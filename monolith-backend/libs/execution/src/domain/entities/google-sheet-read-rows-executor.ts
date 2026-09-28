import { google } from 'googleapis';
import { INodeExecutor } from './node-executor';

export interface GoogleSheetReadRowsConfig {
  credential_id: string;
  spreadsheet_id: string;
  sheet_name: string;
}

export type SheetsClientFactory = (credential: unknown) => any;

export class GoogleSheetReadRowsExecutor
  implements INodeExecutor<GoogleSheetReadRowsConfig, null, Array<Record<string, unknown>>>
{
  readonly key = 'integration.google_sheet.readRows';

  constructor(
    private readonly sheetsClientFactory: SheetsClientFactory = (credential) => {
      const auth = new google.auth.OAuth2();
      auth.setCredentials(credential as Record<string, unknown>);
      return google.sheets({ version: 'v4', auth });
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

    const googleCredential = params.credential as {
      access_token?: string;
      refresh_token?: string;
    } | null;
    if (!googleCredential || typeof googleCredential !== 'object') {
      throw new Error('Google Sheets credential is missing');
    }

    try {
      const sheets = this.sheetsClientFactory(googleCredential);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: params.config.spreadsheet_id,
        range: params.config.sheet_name,
      });

      const rows = (response.data.values ?? []) as unknown[][];
      if (rows.length === 0) {
        return [];
      }

      const [headerRow, ...dataRows] = rows;
      const headers = (headerRow as unknown[]).map((header) => String(header));

      return dataRows.map((row) => {
        const item: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          item[header] = (row[index] ?? '') as unknown;
        });
        return item;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Google Sheets read failed';
      throw new Error(
        message.replace(/(access_token|refresh_token|token|Bearer [A-Za-z0-9._~+/=-]+)/gi, '[REDACTED]'),
      );
    }
  }
}
