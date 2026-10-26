# Exercise videos and recorded training results

## Behavior

- Coaches may save exercises (name, category, instructions and optional YouTube/Vimeo link) to an administrator-only library and reuse them in any block. Copying from the library creates a session snapshot, so editing a draft does not modify other sessions.
- Optional video URLs are canonicalized and restricted to supported HTTPS YouTube/Vimeo forms. The UI opens an ordinary link in a new tab; it does not embed third-party players or load them automatically. No demonstration content is invented or auto-selected. Private/unlisted links must be usable by the intended client.
- Clients open “Registrar cargas y sensaciones” in their session. They can record exercise completion, performed sets/repetitions/load, exercise notes, global effort (1–10) and final sensations. Blank values are not converted into zero or into the prescribed dose.
- Saving results is separate from marking the whole session completed. The coach can consult the athlete's submitted results from the same training card. Coaches cannot overwrite another athlete's report.
- The first result save takes its prescription snapshot and identity from the database, not from client claims. Subsequent saves keep the original snapshot even when a coach changes the plan; the UI explains that distinction. Structured session editing now preserves exercise identifiers; duplication continues to regenerate them.
- Concurrent result saves use a server-maintained revision and a compare-and-set update. A stale update cannot silently overwrite a newer report. Drafts remain available on a save error, with an explicit option to reload the saved version.
- Results are loaded only when their section is opened. Unsaved result changes prompt before switching day, week, athlete or following a same-tab link. Whole-session actions ask the client to save outstanding results first. Drafts are not persisted after the user explicitly discards or reloads them.

## Permissions and migration

Adds `training_exercise_library` and `training_session_results`, both with RLS and no anonymous access. Existing training ownership and paid-premium gates remain authoritative through parent-table visibility. Only an owner with access can insert/update their results; administrators can read reports through their existing training access. Direct result deletion and library updates/deletions are not granted.

The result trigger uses SECURITY INVOKER. It validates the caller against the parent plan and fixes session identity, the original prescription, revision and timestamps. JSON checks reject foreign, duplicate, missing or invalid exercise records. No new SECURITY DEFINER helper is introduced.

## Verification

- 89 local tests, TypeScript and the Next.js production build pass.
- The rollback-only TEST SQL suite covers library administration, video validation, own/foreign write and read permissions, snapshot/timestamp/revision integrity, stale updates, invalid exercise IDs, legacy text sessions and paid-basic denial. Fixture records are rolled back.
- TEST security advisors report no findings introduced by this release; pre-existing helper-function warnings remain.
- Browser-authenticated and HTTP API verification remain unconfirmed because the cloud browser could not access the local server and the previous TEST HTTP request did not complete. No new fixture accounts or messages were created for HTTP testing in this release.

## Limits

This release stores one summary dose per exercise, not a load for each individual set. It uses video links rather than uploaded video storage. It does not add push notifications, whole-week duplication or library rename/delete controls.
