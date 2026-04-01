// src/modules/notifications/channels/push.sender.ts

interface SendPushParams {
  target: string; // e.g. user ID, device token, topic
  title: string;
  body: string;
}

/**
 * Dummy Push sender – free dev setup.
 * Logs to console instead of calling FCM.
 */
export const sendPush = async ({ target, title, body }: SendPushParams) => {
  console.log('🔔 [DEV PUSH MOCK] Would send push notification:', {
    target,
    title,
    body,
  });
};
