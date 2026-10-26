# Membership RLS tests — isolated TEST project

## Local application checks

Run `node --experimental-strip-types --test supabase/tests/*.test.mjs`, `npx tsc --noEmit` and `npm run build` from the repository root. The current local suite has **65 checks**: 20 membership cases, 13 progress cases, 10 trail-log cases, 9 coach-tracking cases and 13 messaging cases.

The trail-log checks cover monthly pagination beyond 1000 records, ownership/date filters, stable ordering, rejection of incomplete loads, and date/numeric validation for creating or editing a run. These use synthetic in-memory responses, perform no database writes, and do not replace authenticated browser verification. The same monthly loader feeds the run history and progress panel.

Coach checks cover complete monthly pagination for runs and plans, paginated athlete choices, failed loads and planner links that preserve a known linked athlete and a valid calendar week. Coach metrics reuse the progress model's Monday-to-Sunday weeks. Direct planner links apply only after the existing administrator check; database permissions remain authoritative. No production records are modified by these tests.

## Private messaging

See `messaging_review.md` for deployment status and access scope. Run `messaging_test_only.sql` only in the isolated TEST project: it creates synthetic identities and messages inside a rollback-only block. It passed **28 checks**, leaving no suite fixtures. `messaging_api_test_only.py` passed **25 real Auth/REST checks** using separately provisioned disposable TEST fixtures, including sign-out. The orchestrator removed their profiles, Auth users, sessions, messages and receipts; fixture credentials were deleted. Result JSON files contain no credentials or message bodies.

The API runner requires a private fixture configuration and does not provision or delete accounts itself. Cleanup must remove the synthetic profiles before their Auth users because the existing profile foreign key does not cascade from Auth. Never run these fixture workflows against production.

## Database verification history

Latest verification: **184 database checks + 133 Auth/API checks passed** after additive membership gates. See `membership_access_review.md` and the `membership_*_results_20261026.json` files. Apply the new membership migration to TEST before running the expanded suites. Earlier 141/112 results below describe the initial verification, before this change.

Production activation: migration `20261026162858_membership_access_guards.sql` was applied on 2026-10-26. All 21 prior policies were preserved; 6 restrictive gates were added. Seventeen read-only checks across the 3 existing accounts passed. See the review for scope and remaining advisor findings.

Target: NH Trail Club TEST (`bsykqjiownewnzguilli`). Never run this suite against production.

Run the complete `rls_memberships_test_only.sql` through Supabase SQL execution against that project. The runner creates only a session-local function and synthetic fixtures inside a subtransaction, tests as the actual `authenticated` / `anon` database roles, and rolls all fixture changes back before returning JSON. Synthetic identities have no login credentials or email addresses. Payment records are fixtures, not financial transactions.

Verified on 2026-10-26: **141 passed, 0 failed, 0 synthetic users remaining**.

Coverage:

- Basic paid, PLUS paid, Performance paid, PLUS unpaid, overdue, pending approval, and payment for the previous month.
- General vs premium access; own and foreign weekly plans, workouts and exercises.
- Own vs foreign subscriptions and dues.
- Athlete cannot promote themselves, approve themselves or mark their own dues paid.
- Activity registration and session booking require eligible payment; foreign registration is denied; own booking cancellation works.
- Admin can read fixture plans, approve subscriptions and record fixture payment; anon cannot read fixture plans or dues.

Limitations:

- These are database role/RLS tests, not Auth API, browser, JWT-signature, email or end-to-end tests.
- TEST has custom `nh_test_*` functions/policies and no application triggers. Its rules differ from production. Passing here does not certify production or its booking capacity, duplicate prevention or immutable fields.
- The read-only production policy inspection found that `weekly_training_plan`, `workouts` and `training_sessions` currently allow owners to read rows without the TEST subscription/payment predicate. The production booking insert policy likewise has no such predicate. No production changes were made.
- No separate Performance-only feature permission was tested.
- No deployment, charge, persistent test account or production write was performed. No remote push is required to execute this SQL suite.

## Auth and REST API verification — 2026-10-26

An additional **112 checks passed, 0 failed** using real password authentication and REST requests against TEST, with its publishable key and actual server-issued access tokens. See `auth_api_results_20261026.json` for individual checks and HTTP status codes; no passwords or tokens are included.

Five disposable identities represented paid Basic, paid PLUS, paid Performance, unpaid PLUS and admin. Checks cover successful login, server verification of identity, premium access and foreign-data isolation, own subscription/dues visibility, blocked self-promotion and self-payment, registration/booking eligibility, own cancellation, logout and rejection of refresh tokens after logout. Anonymous plan access was also denied.

Temporary user, profile, identity, athlete, plan, workout, session, subscription, due, outing, registration and booking records were removed after testing. SQL cleanup verification returned **0 fixture users, 0 fixture Auth sessions, 0 fixture weekly plans, 0 fixture subscriptions**. Temporary credentials were deleted locally.

The Python runner uses only the standard library and a private fixture JSON input, with a hard guard for the exact TEST API URL. Fixture provisioning and privileged cleanup are orchestration steps; the runner alone does not provision or delete database fixtures. It is not installed as a recurring CI workflow.

Browser navigation remains untested. Vercel environment inspection found the `nh-trail-club-tqiv` project's shared Preview/Production Supabase URL points to production (`mibhnqgkbfirxhurxlfg`), rather than TEST. An existing preview in that project therefore cannot be assumed to be an isolated TEST frontend. No environment settings or deployments were changed.

## Visual training builder

`training-builder.test.mjs` checks structured editing, compatibility and duplication. `training_builder_test_only.sql` is guarded for TEST and rolls all fixtures back. `training_builder_api_test_only.py` uses disposable TEST users provisioned separately; always sign out and remove fixtures afterwards. Never run fixture suites in production. See `training_builder_review.md`.
