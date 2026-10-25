import { daysBetween } from "./dates";

// Home's daily words, from the prototype (NEUTRAL, FAITH and SELFCARE), with
// the child's name in place of "he". Scripture is the King James Version with
// divine pronouns capitalized, as the brief asks.

const gentle = (name: string) => [
  "Small steps are still steps forward.",
  `Look how far ${name} has come.`,
  "Progress is not always loud. Some days it is a calm meal and a good nap.",
  "Today does not have to be perfect to be good.",
  `${name} is growing at just the right pace.`,
  "Every therapy session, every meal, every cuddle adds up.",
  `You are exactly who ${name} needs.`,
];

export const SCRIPTURE: readonly (readonly [text: string, reference: string])[] = [
  ["I will praise Thee; for I am fearfully and wonderfully made.", "Psalm 139:14"],
  ["For who hath despised the day of small things?", "Zechariah 4:10"],
  ["Weeping may endure for a night, but joy cometh in the morning.", "Psalm 30:5"],
  ["They that wait upon the LORD shall renew their strength.", "Isaiah 40:31"],
  ["His compassions fail not. They are new every morning.", "Lamentations 3:22–23"],
  ["Casting all your care upon Him; for He careth for you.", "1 Peter 5:7"],
  ["I can do all things through Christ which strengtheneth me.", "Philippians 4:13"],
];

const selfCare = (name: string) => [
  "Drink a glass of water and take three slow breaths.",
  "Text one friend something good about today.",
  `Hand one task to someone else on ${name}'s team today.`,
  "Step outside for five minutes of fresh air.",
  "Eat a real meal, not just coffee.",
  `Rest while ${name} rests. The dishes can wait.`,
  "Write down one bright spot before bed.",
];

/** A number that changes once a day, at midnight in the family's time zone. */
const dayNumber = (today: string) => daysBetween("2000-01-01", today);

/** Today's encouragement: scripture or gentle words, as the family chose in Settings. */
export function encouragement(style: "scripture" | "gentle", today: string, name: string): { text: string; reference?: string } {
  const n = dayNumber(today);
  if (style === "scripture") {
    const [text, reference] = SCRIPTURE[n % SCRIPTURE.length];
    return { text, reference };
  }
  const words = gentle(name);
  return { text: words[n % words.length] };
}

/** Today's small act of self-care for the caregiver ("A moment for you"). */
export function selfCareToday(today: string, name: string): string {
  const list = selfCare(name);
  return list[dayNumber(today) % list.length];
}

export const ALL_GENTLE_WORDS = (name: string) => [...gentle(name), ...selfCare(name)];
