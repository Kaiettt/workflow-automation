import { z } from 'zod';
import { google } from 'googleapis';
import { INodeExecutor } from '../../domain/entities/node-executor';
import { NodeKeys } from '../../domain/constants/execution.constants';

const ConfigSchema = z.object({
  credential_id: z.string().min(1),
  spreadsheet_id: z.string().min(1),
  sheet_name: z.string().min(1),
});

export type GoogleSheetReadRowsConfig = z.infer<typeof ConfigSchema>;

const InputSchema = z.null();

export interface GoogleSheetsValuesResponse {
  data: {
    values?: unknown[][];
  };
}

const CredentialSchema = z
  .object({
    refresh_token: z.string().min(1),
  })
  .passthrough();

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

export type SheetsClientFactory = (credential: {
  refresh_token: string;
}) => GoogleSheetsClient;

export class GoogleSheetReadRowsExecutor implements INodeExecutor<
  GoogleSheetReadRowsConfig,
  null,
  Array<Record<string, unknown>>
> {
  readonly key = NodeKeys.GOOGLE_SHEET_READ_ROWS;
  readonly configSchema = ConfigSchema;
  readonly inputSchema = InputSchema;
  readonly credentialSchema = CredentialSchema;

  constructor(
    private readonly sheetsClientFactory: SheetsClientFactory = (
      credential,
    ) => {
      const auth = new google.auth.OAuth2(
        process.env['google-Client-Id'],
        process.env['google-Client-secret'],
      );
      auth.setCredentials({
        refresh_token: credential.refresh_token,
      });
      return google.sheets({
        version: 'v4',
        auth,
      }) as unknown as GoogleSheetsClient;
    },
  ) {}

  parseConfig(raw: unknown): GoogleSheetReadRowsConfig {
    return this.configSchema.parse(raw);
  }

  parseInput(raw: unknown): null {
    return this.inputSchema.parse(raw);
  }

  parseCredential(raw: unknown) {
    return this.credentialSchema.parse(raw);
  }

  async execute(params: {
    config: GoogleSheetReadRowsConfig;
    input: null;
    credential: unknown;
  }): Promise<Array<Record<string, unknown>>> {
    if (params.input !== null) {
      throw new Error('Google Sheets input must be null');
    }

    const googleCredential = this.parseCredential(params.credential);
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
