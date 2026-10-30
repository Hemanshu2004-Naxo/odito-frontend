/** Server messages are curated and safe to show; a request with no HTTP response gets a plain connectivity message. */
export function describeSectionError(err) {
  if (err && typeof err.status === "number" && err.message) return err.message
  return "Couldn't reach Odito. Check your connection and try again."
}
