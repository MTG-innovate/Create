import "server-only";
import webpush from "web-push";

// Sends Web Push messages from the server. The VAPID private key and the
// reminder sender's secret live only in the server's environment.

export const pushReady = () =>
  Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);

export type PushTarget = { endpoint: string; p256dh: string; auth_key: string };
export type PushMessage = { title: string; body: string; url: string; tag?: string };

/** "gone" means the phone turned reminders off or was reset: forget it. */
export async function sendPush(to: PushTarget, message: PushMessage): Promise<"sent" | "gone" | "failed"> {
  try {
    await webpush.sendNotification(
      { endpoint: to.endpoint, keys: { p256dh: to.p256dh, auth: to.auth_key } },
      JSON.stringify(message),
      {
        vapidDetails: {
          subject: process.env.VAPID_SUBJECT!,
          publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          privateKey: process.env.VAPID_PRIVATE_KEY!,
        },
        // A reminder that arrives hours late is no help.
        TTL: 60 * 60,
        urgency: "high",
      },
    );
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("Push failed", status ?? e);
    return "failed";
  }
}
