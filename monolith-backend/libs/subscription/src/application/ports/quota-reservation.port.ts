export const QUOTA_RESERVATION_PORT = Symbol('QUOTA_RESERVATION_PORT');

export type QuotaTriggerType = 'MANUAL' | 'WEBHOOK' | 'SCHEDULE';

export interface QuotaReservationPort {
  reserveExecutionQuota(
    userId: string,
    triggerType: QuotaTriggerType,
  ): Promise<void>;
}
