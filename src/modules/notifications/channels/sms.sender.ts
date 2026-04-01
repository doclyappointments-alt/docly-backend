// src/modules/notifications/channels/sms.sender.ts

interface SendSmsParams {
  to: string;
  message: string;
}

/**
 * Dummy SMS sender – free dev setup.
 * Logs to console instead of sending real SMS.
 */
export const sendSms = async ({ to, message }: SendSmsParams) => {
  console.log('📱 [DEV SMS MOCK] Would send SMS:', {
    to,
    message,
  });
};
