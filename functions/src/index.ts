import type { Request, Response } from 'express';
import { setGlobalOptions } from 'firebase-functions/v2/options';

import { createHttpFunction, createHttpFunctionAtPath } from './http';
import { sendOtpHandler, verifyOtpHandler } from './routes/otp';
import {
  checkoutHandler,
  wavePaymentHandler,
  apsPaymentHandler,
  afrimoneyPaymentHandler,
  qmoneyPaymentHandler,
  cardPaymentHandler,
  payoutHandler,
  refundHandler,
  balancesHandler,
  transactionHandler,
  webhookHandler,
} from './routes/modempay';
import { printReceiptHandler } from './routes/receipt';
import {
  programMediaUploadHandler,
  programMediaInsertHandler,
} from './routes/program-media';
import { calculatePmuPayoutsHandler } from './routes/pmu-payouts';
import { supportAiHandler } from './routes/support-ai';

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 20,
});

// Each export is a separate Cloud Function with its own public URL:
//   https://us-central1-betesepmu-4ffc7.cloudfunctions.net/<exportName>

// Africell SMS OTP — deployed but not wired to signup until their gateway is reachable from GCP.
export const sendOtp = createHttpFunction(sendOtpHandler);
export const verifyOtp = createHttpFunction(verifyOtpHandler);

// ModemPay checkout (unified + per-method aliases)
export const modempayCheckout = createHttpFunction(checkoutHandler);
export const wavePayment = createHttpFunction(wavePaymentHandler);
export const apsPayment = createHttpFunction(apsPaymentHandler);
export const afrimoneyPayment = createHttpFunction(afrimoneyPaymentHandler);
export const qmoneyPayment = createHttpFunction(qmoneyPaymentHandler);
export const cardPayment = createHttpFunction(cardPaymentHandler);

// ModemPay payouts / refunds / inspection
export const modempayPayout = createHttpFunction(payoutHandler);
export const modempayRefund = createHttpFunction(refundHandler);
export const modempayBalances = createHttpFunction(balancesHandler, { method: 'GET' });
export const modempayTransactions = createHttpFunctionAtPath('/:id', transactionHandler, { method: 'GET' });

// ModemPay webhook — raw body required for HMAC signature verification
export const modempayWebhook = createHttpFunction(webhookHandler, { rawBody: true });

// Sunmi / Thermer receipt
export const printReceipt = createHttpFunction(printReceiptHandler, { method: 'GET' });

// Program media
export const programMediaUpload = createHttpFunction(programMediaUploadHandler);
export const programMediaInsert = createHttpFunction(programMediaInsertHandler);

// PMU dividend engine
export const calculatePmuPayouts = createHttpFunction(calculatePmuPayoutsHandler);

// AI support diagnostics
export const supportAi = createHttpFunction(supportAiHandler);

// Deprecated route still wired by the legacy front-end.
export const authenticateUser = createHttpFunction((_req: Request, res: Response) => {
  res.status(410).json({
    error: 'Endpoint retired',
    detail: 'Custom authenticate-user has been retired — sign in with Firebase Auth from the client.',
  });
});
