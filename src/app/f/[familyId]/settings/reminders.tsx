"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { saveReminderChoices, sendTestReminder, turnOffReminders, turnOnReminders } from "./reminder-actions";

export type MyDevice = {
  id: string;
  endpoint: string;
  visit_evening: boolean;
  visit_soon: boolean;
  night_feed: boolean;
  night_feed_at: string;
};

type Props = {
  familyId: string;
  childName: string;
  devices: MyDevice[];
  vapidKey: string | null;
  visits: boolean;
  nightFeed: boolean;
};

type Phone = "checking" | "unsupported" | "install" | "blocked" | "off" | "on";

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** "Reminders on this phone": each person turns them on for themselves, phone by phone. */
export function Reminders({ familyId, childName, devices, vapidKey, visits, nightFeed }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState<Phone>("checking");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      let next: Phone;
      let current: string | null = null;
      if (!supported) next = ios && !installed ? "install" : "unsupported";
      else if (Notification.permission === "denied") next = "blocked";
      else {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        current = (await registration.pushManager.getSubscription())?.endpoint ?? null;
        next = current && devices.some((d) => d.endpoint === current) ? "on" : "off";
      }
      if (!cancelled) {
        setEndpoint(current);
        setPhone(next);
      }
    })().catch(() => !cancelled && setPhone("unsupported"));
    return () => {
      cancelled = true;
    };
  }, [devices]);

  async function turnOn() {
    if (!vapidKey) return;
    setBusy(true);
    setMessage("");
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setPhone("blocked");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const sub =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) }));
      const result = await turnOnReminders(familyId, sub.toJSON());
      if (result.error) setMessage(result.error);
      else {
        setEndpoint(sub.endpoint);
        router.refresh();
      }
    } catch {
      setMessage("This phone could not turn on reminders. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!endpoint) return;
    setBusy(true);
    // The browser keeps its push address, in case reminders are on here for another family.
    const result = await turnOffReminders(familyId, endpoint);
    setBusy(false);
    if (result.error) setMessage(result.error);
    else router.refresh();
  }

  const mine = devices.find((d) => d.endpoint === endpoint);

  return (
    <section className="card pad">
      <h2>Reminders on this phone</h2>
      {!vapidKey ? (
        <p className="muted">Reminders are not set up for Little Steps yet.</p>
      ) : phone === "checking" ? (
        <p className="muted">Checking this phone…</p>
      ) : phone === "install" ? (
        <p className="muted">
          On iPhone, add Little Steps to your Home Screen first: tap the Share button, then &ldquo;Add to Home Screen&rdquo;. Open it from
          there and come back here to turn on reminders.
        </p>
      ) : phone === "unsupported" ? (
        <p className="muted">This browser cannot show reminders. Try Little Steps on your phone, added to the Home Screen.</p>
      ) : phone === "blocked" ? (
        <p className="muted">Notifications are turned off for Little Steps in this phone&rsquo;s settings. Turn them on there, then come back.</p>
      ) : phone === "off" || !mine ? (
        <>
          <p className="muted">
            Get a gentle reminder before {childName}&rsquo;s visits{nightFeed ? " and when it is time for the night feed" : ""}. Only on this phone,
            only for you.
          </p>
          <div className="actions">
            <button type="button" className="btn primary" onClick={turnOn} disabled={busy}>
              {busy ? "Turning on…" : "Turn on reminders"}
            </button>
          </div>
        </>
      ) : (
        <>
          <ActionForm action={saveReminderChoices} submit="Save" pendingLabel="Saving…">
            <input type="hidden" name="familyId" value={familyId} />
            <input type="hidden" name="deviceId" value={mine.id} />
            {visits ? (
              <>
                <label className="choice">
                  <input type="checkbox" name="visitEvening" defaultChecked={mine.visit_evening} />
                  <span>The evening before a visit</span>
                </label>
                <label className="choice">
                  <input type="checkbox" name="visitSoon" defaultChecked={mine.visit_soon} />
                  <span>About an hour before a visit</span>
                </label>
              </>
            ) : null}
            {nightFeed ? (
              <>
                <label className="choice">
                  <input type="checkbox" name="nightFeed" defaultChecked={mine.night_feed} />
                  <span>The night feed, until someone logs it</span>
                </label>
                <div className="field half">
                  <label htmlFor="nightFeedAt">Night feed reminder at</label>
                  <input id="nightFeedAt" name="nightFeedAt" type="time" defaultValue={mine.night_feed_at.slice(0, 5)} required />
                </div>
              </>
            ) : (
              <input type="hidden" name="nightFeedAt" value={mine.night_feed_at.slice(0, 5)} />
            )}
          </ActionForm>
          <p className="muted small">Reminders show the kind of visit and the time, never notes.</p>
          <div className="actions">
            <ActionForm action={sendTestReminder} submit="Send a test reminder" pendingLabel="Sending…" plain>
              <input type="hidden" name="familyId" value={familyId} />
              <input type="hidden" name="deviceId" value={mine.id} />
            </ActionForm>
            <button type="button" className="btn small" onClick={turnOff} disabled={busy}>
              Turn off on this phone
            </button>
          </div>
        </>
      )}
      {message ? (
        <p className="banner" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
