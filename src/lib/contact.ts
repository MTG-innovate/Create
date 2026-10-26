import "server-only";

/** Where families reach the JOSIA Care team (CONTACT_EMAIL), if set. */
export const contactEmail = () => process.env.CONTACT_EMAIL?.trim() || null;
