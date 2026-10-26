# Goal-centred runner preparation

## Complete workflow

`/objetivos` provides one active main objective per linked runner, an editable preparation calendar and weekly coach reviews. The runner can read their preparation; administrators create and revise it. The form records the goal type, priority, deadline, distance/elevation when relevant, terrain, baseline, experience, real availability and intermediate priorities. Historic completed/archived goals remain available.

Preparation phases are dated and cannot overlap while active. They can be edited, archived and restored. A draft distribution divides the preparation into four equal calendar sections and adds a recovery week: it is explicitly an editable organisational suggestion, never an automatic training prescription. Each proposed phase is reviewed and saved by the coach.

The planner displays the active objective, phases intersecting the selected week and the preceding week's coaching focus. New sessions default to the active goal, with a required statement of purpose when linked. Existing unlinked sessions are preserved; they can be linked explicitly when edited. Copies/templates keep athlete and goal assignment separate from exercise prescriptions.

The client sees why each linked strength or trail session contributes to the objective. Both modalities stay in their existing separate tabs, with the complete weekly calendar covering all modalities. The legacy empty `objetivos_deportivos` table and its existing policies are unchanged.

Weekly review combines completion of sessions linked to this goal, the runner's recorded activities for the calendar week, and reported effort/sensations from linked sessions. Activity totals are clearly labelled as all recorded runs, not an inferred objective progress score; planned sessions are not added again as completed activity. The coach records a balance, decision and next-week focus and can open the next week's planner. Clients read the published review. No message or push notification is sent.

## Permissions and integrity

The migration adds `runner_goals`, `runner_goal_phases`, `runner_goal_reviews`, and nullable goal linkage plus purpose on weekly plans. All new tables have RLS; anonymous access and direct deletes are denied. Read access follows owner/admin and paid-premium gates. Only administrators write coaching records. Existing plan ownership and membership policies remain unchanged.

Invoker triggers fix authorship/timestamps/revisions, prevent reassignment, serialize phase overlap checks through a parent row lock and reject linking a plan to another runner's goal. Updates use revisions to avoid overwriting concurrent changes. Archiving preserves history and session links. Goal records do not overwrite the immutable performance snapshots already held by submitted training results.

## Verification

- 128 local tests, including goal dates, availability, phase proposals, weekly data pagination, distinct activity/planning totals and rendered form controls, pass.
- TypeScript and the production build pass.
- 31 rollback-only goal SQL checks pass in TEST: one active objective, phase overlap denial, review revisions, ownership, parent links, client read-only access, paid-basic denial, old unlinked sessions and completion RPC compatibility. Zero fixture users/goals remain.
- The previous 31 result-recording SQL checks also pass after the new plan trigger is installed.
- TEST advisors report no new security findings; pre-existing test helper notices remain.
- Authenticated browser and live HTTP API flow are not confirmed in this environment. Previous cloud-browser/local-server and HTTP access limitations remain; no production fixtures are used as a substitute.
