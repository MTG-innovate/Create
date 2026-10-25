// Only the public URL and publishable key reach the browser. There is no
// service key in this app: every query runs as the signed-in person.
export const publicEnv = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
};

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in.`);
  return value;
}
