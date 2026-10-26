# Visual training builder — first release

The trainer selects the athlete and week, creates or edits warm-up / main / cool-down blocks, previews the client view, then saves the structured prescription. Clients see a seven-day selector, targets, exercise cards and their existing complete-session action and private chat link.

## Included

- Three optional stages, ordered exercises, sets, free-text repetitions or intervals, load, rest, duration, intensity and notes.
- Four editable starter templates and persistent team templates, visible/creatable only by administrators. Templates contain no athlete, calendar date or completion state.
- Duplicating a session opens an unsaved copy, regenerates exercise identifiers and preserves every prescribed field. The copy is saved as a new, incomplete session only after selecting a date and saving.
- Live preview reuses the client rendering component. Responsive grids and 44px controls support mobile; no drag gesture is required for ordering.
- Original text sessions still render and can be edited/duplicated without attempting a lossy automatic exercise parser. Structured sessions keep a full plain-text fallback for older consumers. Editing does not append that fallback into the structure.
- Save validation and errors remain adjacent to the save control. Template and session writes are independent and labelled. In-flight writes are guarded against repeated clicks. Switching athlete/week or replacing a draft asks before discarding it.

## Data and permissions

The additive migration adds nullable `weekly_training_plan.structure` with a bounded JSON validator, and `training_templates` with RLS. Existing plan ownership and paid-premium policies are preserved. Anonymous access is denied. Clients cannot read team templates or change the prescribed blocks. The existing completion RPC only changes completion state. No definer functions or broadened plan grants are introduced.

## Validation

- 77 local checks, TypeScript and the production build pass.
- 23 rollback-only SQL checks pass in TEST, including create/edit/duplicate, exact JSON roundtrip, legacy records, template ownership, invalid JSON denial, client/foreign isolation, paid-basic denial and preservation of prescription on completion. Zero fixture users/templates remain after this suite.
- Auth/REST fixture checks could not complete: the HTTP request did not respond from this environment. The suite was stopped, and privileged cleanup confirmed zero fixture users remain. No API pass is claimed.
- TEST security advisors show no findings introduced by this release; existing TEST helper-function notices remain.
- Authenticated visual browser verification is pending. The cloud browser cannot reach the local development server (`ERR_CONNECTION_REFUSED`); no claim of completed browser testing is made.

## Deferred to the next stage

Video library, recording actual weights or per-exercise completion, final effort/sensations, whole-week duplication and template management (rename/delete). This release does not collect those results or send notifications.
