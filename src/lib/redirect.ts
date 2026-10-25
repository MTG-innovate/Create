/**
 * A redirect to a path on this site. The Location stays relative, because the
 * server's idea of its own address (for example "localhost" behind a proxy)
 * may differ from the address in the person's browser, and the sign-in
 * cookie only belongs to the address they used.
 */
export function redirectTo(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path } });
}
