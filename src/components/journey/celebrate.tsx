"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * A short confetti burst for a new win (the prototype's celebrate). Skipped
 * when the device asks for reduced motion.
 */
export function celebrate() {
  if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const css = getComputedStyle(document.documentElement);
  const colors = ["--accent", "--feed", "--weight", "--exercise", "--sleep", "--nurse"].map((v) => css.getPropertyValue(v).trim() || "#F4B33F");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", zIndex: "30", pointerEvents: "none" });
  document.body.append(canvas);
  const W = (canvas.width = innerWidth);
  const H = (canvas.height = innerHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();
  const bits = Array.from({ length: 90 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3,
    y: H * 0.35,
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 9 - 3,
    r: Math.random() * 6 + 4,
    c: colors[Math.floor(Math.random() * colors.length)],
    a: Math.random() * 6,
    round: Math.random() > 0.5,
  }));
  const start = performance.now();
  const frame = (t: number) => {
    const k = (t - start) / 1600;
    ctx.clearRect(0, 0, W, H);
    for (const p of bits) {
      p.vy += 0.28;
      p.x += p.vx;
      p.y += p.vy;
      p.a += 0.15;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillStyle = p.c;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.r / 2, 0, 7);
        ctx.fill();
      } else ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    }
    if (k < 1) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/** Celebrates once when the page opens with ?celebrate=1 (after saving a win), then tidies the address. */
export function CelebrateOnArrival() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (params.get("celebrate") !== "1") return;
    celebrate();
    const next = new URLSearchParams(params);
    next.delete("celebrate");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [params, pathname, router]);
  return null;
}
