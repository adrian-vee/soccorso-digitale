import path from "node:path";

/**
 * Resolved base directory for all user-uploaded files.
 *
 * Set the UPLOADS_DIR environment variable to point to a Railway persistent
 * volume (e.g. UPLOADS_DIR=/app/uploads).  When the variable is absent the
 * directory falls back to <cwd>/uploads — which is /app/uploads inside the
 * Docker container, so an unset variable still works with a Railway volume
 * mounted at /app/uploads.
 */
export const UPLOADS_DIR: string = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), "uploads");
