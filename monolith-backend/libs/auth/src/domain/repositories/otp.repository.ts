import { OtpType } from '../enums/otp-type.enum';

export interface OtpRecord {
  id: string;
  email: string;
  code: string;
  type: OtpType;
  isUsed: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export abstract class OtpRepository {
  abstract create(
    email: string,
    code: string,
    type: OtpType,
    expiresAt: Date,
  ): Promise<OtpRecord>;
  abstract findLatestValid(
    email: string,
    code: string,
    type: OtpType,
  ): Promise<OtpRecord | null>;
  abstract markAsUsed(id: string): Promise<void>;
}
