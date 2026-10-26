# Private messaging — implementation review

Status: developed and verified against NH Trail Club TEST. **The migration has not been activated in production.** Production activation and the main-branch release await explicit approval. Existing Vercel previews share the production database and cannot be used as isolated TEST frontends. Authenticated visual browser verification remains pending.

## User experience

- `/mensajes` provides a private client conversation and an administrator inbox. Administrators can initiate or reply to any athlete profile; there is no separate trainer-assignment model in the current app.
- Clients can only view and write their own conversation. All club administrators act as the trainer team. Communication is available independently of membership payment, including from membership notices.
- Text messages, server timestamps, paginated history and unread counts persist in the database. An optional training reference is checked against the conversation owner on the server, and its title/date snapshot remains in the history.
- Dashboard navigation, the training hub, coach tracking cards and individual plan sessions link to messaging. The dashboard shows an unread summary.
- Conversations refresh every 8 seconds and dashboard counts every 20 seconds while the page is visible; focus refreshes them sooner. These are in-app updates, without push notifications or external email/SMS.
- Drafts survive conversation switches within the open page, but are not persisted across reloads. Retrying the same unconfirmed send within that page reuses its message identifier. The server returns the existing message instead of inserting a duplicate.
- Read cursors advance when the conversation is visible, focused and at its latest messages. Each administrator has independent unread state. No read ticks are presented as evidence that a particular trainer has replied or read a message.

## Database access

Migration: `20261026185624_private_messaging.sql`.

- Adds `club_messages` and `club_message_reads`, both with RLS. Existing application tables and policies are preserved.
- Grants authenticated users SELECT subject to participant/receipt ownership policies. Direct message/receipt INSERT, UPDATE and DELETE are denied, and anonymous access is denied.
- Public RPC wrappers are SECURITY INVOKER. Narrow, authenticated SECURITY DEFINER implementations live in the private `nh_chat` schema with fixed empty search paths and explicit actor/conversation checks.
- Sender identity and timestamps come from the server. Message IDs provide idempotency. Conversation-level transaction locks ensure committed message sequence order, preventing read cursors from skipping a concurrent lower-sequence send.
- Read markers are monotonic, bounded to an existing sequence and scoped to the signed-in reader. Training references must belong to the conversation's athlete.
- No attachments, message deletion/editing, external delivery or new authentication settings are introduced.

## Verification

- **65 local checks**, TypeScript and production build pass, including 13 new messaging cases for identity selection, chronological merges, pagination beyond 100 updates, error handling and message validation.
- **28 rollback-only SQL checks** test real Postgres roles, own/foreign access, server sender identity, idempotency, context ownership, immutable messages, read cursors and anonymous denial.
- **25 Auth/REST checks** use real TEST access tokens for two disposable clients and an administrator. They verify sending, reply, unread/read state, foreign isolation, direct-write denial, anonymous denial and logout.
- Cleanup verification: zero fixture users, sessions, messages or receipts. No real client/coach messages were sent during testing.
- TEST security advisors reported no new messaging findings. Existing warnings concern pre-existing TEST helper functions and are outside this feature.

Production is not functionally verified for chat until the migration is explicitly approved and activated. Never run the fixture suites in production.
