import { expect, it } from "vitest";
import { gettingStarted, type StartInput } from "./getting-started";

const fresh: StartInput = { familyId: "f", childName: "Josiah", birthDate: null, othersOrInvites: 0, visits: 0, cardFilled: false, reminders: false };

it("starts with every step to do, in Josiah's name", () => {
  const steps = gettingStarted(fresh);
  expect(steps.map((s) => s.label)).toEqual([
    "Add Josiah's birthday and due date",
    "Invite someone to Josiah's Care Circle",
    "Add Josiah's next visit",
    "Fill in Josiah's emergency card",
    "Turn on reminders on your phone",
  ]);
  expect(steps.every((s) => !s.done)).toBe(true);
  expect(steps[1].href).toBe("/f/f/people");
});

it("ticks each step off from what the Care Circle has done", () => {
  const steps = gettingStarted({ ...fresh, birthDate: "2025-04-12", othersOrInvites: 1, visits: 2, cardFilled: true, reminders: true });
  expect(steps.every((s) => s.done)).toBe(true);
});
