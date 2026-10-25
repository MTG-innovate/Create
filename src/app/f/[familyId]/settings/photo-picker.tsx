"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { setPhoto } from "./actions";

/**
 * Uploads straight into the child's private folder. Storage rules let only
 * owners and family add photos there.
 */
export function PhotoPicker({ familyId, childId, childName, hasPhoto }: { familyId: string; childId: string; childName: string; hasPhoto: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    setStatus("Adding the photo…");
    const blob = await shrinkPhoto(file);
    const path = `${familyId}/${childId}/${crypto.randomUUID()}.jpg`;
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    const { error } = await supabase.storage.from("child-photos").upload(path, blob, { contentType: blob.type || "image/jpeg" });
    if (error) {
      setStatus(/size|large/i.test(error.message) ? "That photo is too large. Try a smaller one." : "Could not add the photo. Try again.");
      setBusy(false);
      return;
    }
    const result = await setPhoto(familyId, childId, path);
    setStatus(result.error ?? "Photo added");
    setBusy(false);
    router.refresh();
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        aria-label={`Choose a photo of ${childName}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <button type="button" className="btn small" disabled={busy} onClick={() => input.current?.click()}>
        {hasPhoto ? "Change photo" : "Add a photo"}
      </button>
      <span role="status" className="small muted">
        {status}
      </span>
    </>
  );
}
