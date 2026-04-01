import '../common/config/redis.js';
import { startReminderWorker } from '../common/queues/reminderQueue.js';
import { startCalendarSyncWorker } from '../common/queues/calendarSyncQueue.js';
import { startStripeWorker } from '../common/queues/stripeEventQueue.js';

console.log('[WORKER] Starting workers');

startReminderWorker();
startCalendarSyncWorker();
startStripeWorker();
