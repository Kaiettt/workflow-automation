export abstract class EmailService {
  abstract sendOtpEmail(
    email: string,
    otp: string,
    purpose: 'REGISTER' | 'FORGOT_PASSWORD',
  ): Promise<void>;
}
