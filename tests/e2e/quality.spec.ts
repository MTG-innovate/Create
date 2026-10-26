import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// The feel of a well-made phone app: every tap target is at least 44 points
// (Apple's guideline, and kind to tired hands), and no screen scrolls sideways.
// A radio or checkbox counts by its whole label, and a link inside a sentence
// is part of the text.

const SCREENS = ["", "/visits", "/visits/new", "/diary", "/journey", "/helpers", "/people", "/settings", "/capture/nurse", "/card", "/helpers/supplies/new", "/helpers/medicines/new", "/feedback"];

test("every main screen has full-size tap targets and fits the phone", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  const base = parent.url();
  for (const path of SCREENS) {
    await parent.goto(base + path);
    const problems = await parent.evaluate(() => {
      const small = [...document.querySelectorAll<HTMLElement>("a, button, input, select, textarea, summary")]
        .filter((el) => {
          if ((el as HTMLInputElement).type === "hidden") return false;
          if (el.closest("p, li") && el.tagName === "A" && !el.className) return false;
          const target = el.matches("input[type=radio], input[type=checkbox]") ? (el.closest("label") ?? el) : el;
          const r = target.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44);
        })
        .map((el) => `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`);
      const sideways = document.documentElement.scrollWidth > window.innerWidth;
      return { small, sideways };
    });
    expect(problems.small, `small tap targets on ${path || "Home"}`).toEqual([]);
    expect(problems.sideways, `${path || "Home"} scrolls sideways`).toBe(false);
  }
});
