export interface VNPayCreatePaymentParams {
  transactionReference: string;
  amount: number;
  orderInfo: string;
  ipAddress: string;
}

export interface VNPayCallbackParams {
  vnp_Amount: string;
  vnp_BankCode?: string;
  vnp_BankTranNo?: string;
  vnp_CardType?: string;
  vnp_OrderInfo?: string;
  vnp_PayDate?: string;
  vnp_ResponseCode: string;
  vnp_TmnCode: string;
  vnp_TransactionNo: string;
  vnp_TransactionStatus: string;
  vnp_TxnRef: string;
  vnp_SecureHash: string;
  vnp_SecureHashType?: string;
}

export interface VNPayPaymentResult {
  signatureValid: boolean;
  transactionReference: string;
  transactionId?: string;
  amount: number;
  responseCode: string;
  transactionStatus: string;
  successful: boolean;
}
