// The first-run checklist an owner sees on Home: the few things that make
// JOSIA Care useful from day one. Each step is done when the data says so.

export type StartStep = { key: string; label: string; href: string; done: boolean };

export type StartInput = {
  familyId: string;
  childName: string;
  birthDate: string | null;
  /** People in the Care Circle besides the owner, or invitations still open. */
  othersOrInvites: number;
  visits: number;
  cardFilled: boolean;
  /** Reminders turned on, on any of this person's phones. */
  reminders: boolean;
};

export function gettingStarted(s: StartInput): StartStep[] {
  const base = `/f/${s.familyId}`;
  return [
    { key: "birthday", label: `Add ${s.childName}'s birthday and due date`, href: `${base}/settings`, done: Boolean(s.birthDate) },
    { key: "invite", label: `Invite someone to ${s.childName}'s Care Circle`, href: `${base}/people`, done: s.othersOrInvites > 0 },
    { key: "visit", label: `Add ${s.childName}'s next visit`, href: `${base}/visits/new`, done: s.visits > 0 },
    { key: "card", label: `Fill in ${s.childName}'s emergency card`, href: `${base}/card`, done: s.cardFilled },
    { key: "reminders", label: "Turn on reminders on your phone", href: `${base}/settings`, done: s.reminders },
  ];
}
