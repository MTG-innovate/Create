import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Short-lived links to children's photos. The bucket is private; a link works
 * for an hour and only after the database has checked the person belongs to
 * the family.
 */
export async function photoUrls(children: { id: string; photo_path: string | null }[]): Promise<Map<string, string>> {
  const withPhotos = children.filter((c) => c.photo_path);
  if (!withPhotos.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.storage.from("child-photos").createSignedUrls(
    withPhotos.map((c) => c.photo_path!),
    60 * 60,
  );
  const byPath = new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  return new Map(withPhotos.flatMap((c) => (byPath.has(c.photo_path) ? [[c.id, byPath.get(c.photo_path)!]] : [])));
}
