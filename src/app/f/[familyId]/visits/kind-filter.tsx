"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { VISIT_KINDS } from "@/lib/visits";

/** "Show: All visits / Cardiology / ..." */
export function KindFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <div className="field">
      <label htmlFor="kindFilter">Show</label>
      <select
        id="kindFilter"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value) next.set("kind", e.target.value);
          else next.delete("kind");
          router.push(`${pathname}${next.size ? `?${next}` : ""}`);
        }}
      >
        <option value="">All visits</option>
        {VISIT_KINDS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    </div>
  );
}
