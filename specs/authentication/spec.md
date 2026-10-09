Status: ready-for-agent

## Problem Statement

Users (Workflow Developers, Business Users, and Administrators) need a secure, intuitive, and robust way to register accounts, sign in, manage active sessions, and recover forgotten passwords. Without an email verification mechanism, malicious or mistyped email registrations can pollute the system. Furthermore, storing ephemeral one-time passwords (OTPs) in the relational database risks bloat and performance degradation, while relying on console logs or insecure mock codes compromises production security.

## Solution

A complete, production-grade Authentication and Authorization system for FlowPilot:
1. **Interactive Auth Modal**: Allows users to seamlessly toggle between Sign In, Sign Up, and Forgot Password directly within the application.
2. **Real-time Password Strength Meter**: Provides immediate visual feedback on password complexity (length, uppercase, lowercase, numbers, special characters) and confirms password match before submission.
3. **Redis-backed OTP Verification**: Implements a 2-step registration and password recovery flow. OTPs (6-digit numeric codes) are stored in Redis with an automatic 5-minute TTL (Time-To-Live) and deleted immediately upon successful verification, keeping the primary relational database completely clean.
4. **Real SMTP Email Delivery**: Sends beautifully formatted verification emails via Nodemailer with strict SMTP configuration, ensuring users receive their OTPs in their inbox without insecure UI autofill or debug log exposure.
5. **Role-Based Access Control (RBAC)**: Supports roles (`ADMIN`, `DEVELOPER`, `BUSINESS_USER`) embedded in signed JWT tokens, with user profile retrieval (`/me`) and secure session persistence.

## User Stories

1. As a Business User, I want to view an authentication modal from the navigation bar, so that I can easily sign in or register without losing my current page context.
2. As a Business User, I want to see real-time visual feedback on my password strength while registering, so that I can create a secure password that meets enterprise security standards.
3. As a Business User, I want immediate validation when my password confirmation does not match the entered password, so that I don't submit mismatched credentials.
4. As a Business User, I want to select my role (`DEVELOPER` or `BUSINESS_USER`) during registration, so that my account is assigned appropriate initial permissions.
5. As a Business User, I want to receive a 6-digit OTP in my email inbox upon submitting the registration form, so that I can verify that I own the email address.
6. As a Business User, I want the system to warn me if an email address is already registered before sending an OTP, so that I can choose to log in instead.
7. As a Business User, I want to enter my 6-digit OTP in a dedicated verification screen, so that my registration is completed securely.
8. As a Business User, I want the ability to request a new OTP if my current code expired or was not received, so that I am not permanently blocked from completing registration.
9. As a Business User, I want clear countdown and error messaging if an entered OTP is incorrect or expired, so that I understand why verification failed.
10. As a Business User, I want to log in using my registered email and password, so that I can access my workflows and account data.
11. As a Business User, I want my authentication session to persist across page reloads via a JWT token, so that I don't have to repeatedly re-authenticate.
12. As a Business User, I want to see my profile avatar, name, email, and role in the navigation bar when logged in, so that I know which account is active.
13. As a Business User, I want to securely log out with a single click, so that unauthorized persons cannot access my account on shared devices.
14. As a Business User, I want to initiate a "Forgot Password" flow by entering my email address, so that I can regain access to my account if I forget my credentials.
15. As a Business User, I want to receive a password reset OTP via email, so that only the email owner can reset the account password.
16. As a Business User, I want to enter the reset OTP along with my new password and confirmation, so that my password is updated in a single verified step.
17. As a Workflow Developer, I want to be automatically redirected or authorized based on my `DEVELOPER` role, so that I can access workflow design and debugging features.
18. As an Administrator, I want users' sensitive credentials to be stored as salted hashes (bcrypt) and ephemeral OTPs to be kept in memory-backed storage, so that the primary database remains clean, high-performing, and secure.

## Implementation Decisions

- **Architecture & Pattern**: The Monolith Backend follows Clean Architecture and CQRS (Command Query Responsibility Segregation). The Auth feature is encapsulated into its own dedicated module, exposing clean commands and queries (`SendRegisterOtpCommand`, `VerifyOtpCommand`, `RegisterCommand`, `LoginCommand`, `RefreshTokenCommand`, `GetCurrentUserQuery`, `ForgotPasswordCommand`, `ResetPasswordCommand`).
- **Clean Architecture Email Decoupling**: The application layer depends on the `EmailService` domain abstraction (`libs/auth/src/domain/services/email.service.ts`). The infrastructure layer provides `NodemailerEmailService`, cleanly bound in `AuthModule`. Reusable HTML and plain-text email templates are generated via `EmailTemplateBuilder` rather than inline strings.
- **Storage Strategy for OTPs**: OTPs are strictly stored in Redis with a 5-minute TTL (`EX 300`). No OTP records are stored in PostgreSQL, and any legacy OTP relational tables have been removed. Keys are structured with domain namespaces (e.g. `otp:register:<email>` and `otp:reset:<email>`) and are automatically deleted upon successful verification.
- **Decoupled Verification**: A dedicated `POST /auth/verify-otp` endpoint validates OTPs and records verified status in Redis (`otp:verified:<type>:<email>`) with a 15-minute TTL, allowing flexible two-step registration and password reset workflows.
- **Refresh Token Mechanism**: 
  - `accessToken`: 15-minute expiration, containing `sub`, `email`, and `role`.
  - `refreshToken`: 7-day expiration, stored in Redis (`refresh_token:<userId>`) with 7-day TTL.
  - `POST /auth/refresh`: Validates refresh token against Redis, verifies user active state, and issues a new access token and rotated refresh token.
- **Frontend HTTP Client Architecture**: 
  - Shared Axios instance (`frontend/src/shared/api/http-client.ts`) with request and response interceptors.
  - Request Interceptor: Reads `accessToken` from `auth.store` and automatically injects `Authorization: Bearer <token>` on all requests.
  - Response Interceptor: Intercepts `401 Unauthorized` responses, calls `POST /auth/refresh` with `refreshToken`, replays failed requests with the new access token, and triggers `logout()` if refresh fails.
  - Migrated both `auth.api.ts` and `workflow.api.ts` to use this shared client.
- **Email Delivery Mechanism**: Transports OTP emails via real SMTP through `NodemailerEmailService`. Credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) are loaded from environment variables. For local development, MailHog (`mailhog/mailhog:v1.0.1`) runs via Docker Compose on port 1025 (SMTP) and port 8025 (Web UI).
- **Password Security**: Passwords must meet minimum complexity criteria (minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character). Passwords are hashed using bcrypt with a salt round factor of 10 prior to persistence.
- **API Contracts**:
  - `POST /api/v1/auth/send-register-otp`: Validates uniqueness of email and dispatches a 6-digit OTP to the email address.
  - `POST /api/v1/auth/verify-otp`: Accepts `{ email, otp, type }`, verifies OTP code in Redis, and marks email as verified for 15 minutes.
  - `POST /api/v1/auth/register`: Accepts name, email, password, role, and optional OTP. Checks verification status or verifies OTP, creates user in PostgreSQL, and issues both access and refresh tokens.
  - `POST /api/v1/auth/login`: Validates email and password, returning user details, `accessToken` (15m), and `refreshToken` (7d).
  - `POST /api/v1/auth/refresh`: Accepts `{ refreshToken }`, verifies against Redis, and returns a new token pair.
  - `GET /api/v1/auth/me`: Validates the Bearer JWT token and returns the current authenticated user's profile.
  - `POST /api/v1/auth/forgot-password`: Checks user existence and dispatches a 6-digit password reset OTP to the email address.
  - `POST /api/v1/auth/reset-password`: Accepts email, OTP, and new password. Verifies OTP from Redis, updates the user's hashed password, and invalidates the OTP.

## Testing Decisions

- **Testing Seam Principle**: Tests must evaluate external behavior at the highest possible seams without testing internal implementation details or mocking CQRS internals.
- **Backend Testing Seam**: HTTP API Integration Tests on `apps/api` (`/api/v1/auth/*`). The test suite communicates directly via HTTP calls against running or test-instantiated NestJS application instances with real Redis and PostgreSQL test instances. Assertions verify:
  - HTTP status codes (200, 201, 400, 401, 404, 409).
  - JWT token validity, expiration, and payload contents.
  - Token refresh and rotation via `POST /auth/refresh`.
  - Redis key creation, TTL enforcement, and post-verification deletion.
  - User creation in PostgreSQL and password hash verification.
- **Frontend Testing Seam**: Component and user flow integration tests on `AuthModal`, `features/auth`, and Axios interceptors using React Testing Library. Assertions verify:
  - Switching between Login, Register, and Forgot Password modes.
  - Password strength validation bar changes color and width as characters are typed.
  - Form submission triggers OTP step and renders the 6-digit OTP input.
  - Zustand `auth.store` properly updates `user`, `token`, `refreshToken`, and `isAuthenticated` states.
  - Shared Axios interceptor intercepts 401 and calls refresh endpoint.

## Out of Scope

- Multi-factor authentication (MFA/TOTP) via authenticator apps (Google Authenticator, Authy).
- Social / OAuth2 login providers (Google, GitHub, Microsoft).
- Multi-tenant Organization/Team management (planned for post-MVP).

## Further Notes

- **MailHog Local Testing**: Run `docker-compose up -d mailhog` and view sent emails at `http://localhost:8025`.
- **Database Seeding**: `monolith-backend/prisma/seed.ts` does not run automatically on app start; it is executed manually via `npx prisma db seed`.
- Production deployments require valid SMTP relay credentials configured in environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
- Redis service is managed via Docker Compose (`flowpilot-redis`).
