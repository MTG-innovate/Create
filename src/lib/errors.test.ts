import { describe, expect, it } from "vitest";
import { friendlyError, safeNext } from "./errors";

describe("friendlyError", () => {
  it("shows the database's own plain words", () => {
    expect(friendlyError({ code: "23514", message: "A family always needs at least one owner" })).toBe(
      "A family always needs at least one owner",
    );
    expect(friendlyError({ code: "42501", message: "Only an owner can invite people" })).toBe("Only an owner can invite people");
  });

  it("hides technical messages", () => {
    expect(friendlyError({ code: "42501", message: "permission denied for table children" })).toMatch(/permission/);
    expect(friendlyError({ code: "42501", message: 'new row violates row-level security policy for table "wins"' })).not.toMatch(
      /row-level/,
    );
    expect(friendlyError({ code: "XX000", message: "internal" })).toMatch(/did not save/);
  });
});

describe("safeNext", () => {
  it.each([
    ["/f/abc", "/f/abc"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    [undefined, "/"],
  ])("%s -> %s", (input, out) => {
    expect(safeNext(input)).toBe(out);
  });
});
