# BTN TMG Strava Tracker

Mobile-first Next.js application with Vietnamese UI and 48px touch controls.

## Development

Copy `.env.example` to `.env.local` and supply the Supabase project URL and publishable key. Run `npm ci`, then `npm run dev`.

Validation: `npm run lint`, `npm run typecheck`, `npm run build`.

## Members and access

The home page and `/members` use real Supabase authentication and database records. The REVIVE identity uses the supplied logo and blue, lime, and orange palette; `/about` presents the theme, scripture, event timeline, and organizer slides. `/demo` is an illustrative activity dashboard; it does not contribute competition results.

- Admin: assign members to divisions/groups, link login accounts, assign roles.
- Leader: view the participant roster. Activity review is a future module.
- User: view the participant roster after an admin links their account.
- Unlinked accounts and anonymous visitors cannot read the roster.

Database RLS and admin-only RPCs enforce authorization. Clients cannot directly update roles or member assignments. SQL migrations are in `supabase/migrations`; rollback-only authorization checks are in `supabase/tests/roles.sql`.

The initial admin reservation is private and activates once the reserved email is verified. It then links the reserved Strava athlete and removes the reservation. Do not disable email verification to bypass this step.

## Strava data

The current roster was collected from all three pages of club 2368312 in the authenticated Strava website, deduplicated by athlete ID, and imported into Supabase. There are 65 members. Strava club Owner/Admin labels do not grant website permissions. All division/group assignments initially remain empty.

Local snapshots in `exports/` and the generated `supabase/seed-members.sql` are ignored by Git. Re-imports must update source fields only, preserving manual assignments. Website synchronization is currently manual; no automated activity or steps ingestion is implemented. No Strava session cookie is stored in this repository.

## Deployment

Deploy to Vercel with both public Supabase environment variables. Configure Supabase Auth Site URL and allowed redirects for the production URL before email confirmation or password-reset links are used. Configure a working SMTP provider for participant signup; successful builds do not verify email delivery.

## Club activity review

The admin-only **Hoạt động** tab in `/members` imports the extension's normalized activities export (including excluded records). Imports are atomic, limited to 1,000 records per file, and deduplicate by activity ID without overwriting previously reviewed values. Original source data is retained. Invalid parsed party sizes remain unknown in editable fields.

New activities are pending and have zero credited points. Admins can edit steps, party size and division, save pending, approve or reject. Approval requires a current active member with a small-group assignment, a matching division, Walk sport, local activity date within 2026-10-04 through 2026-11-15, and steps/party size. Corrected or manually supplied steps require a note. Party size includes the activity author; solo is base steps, otherwise round(steps * (1 + party_size / 10)). Group assignment is snapshotted when approved. Returning to pending or rejecting removes credited points. Optimistic revision checks prevent stale updates, and reviews append audit records.

Database migration files `202610130002_club_activities.sql` and `202610130003_import_invalid_party_size.sql` define RLS and admin-only RPCs. Direct authenticated writes and anonymous access are not granted. The transactional test `supabase/tests/club_activities.sql` rolls back its fixtures and checks authorization, deduplication, points, stale reviews and notes. `node --test tests/*.test.mjs` checks the frontend helpers and existing portal behavior.

The extension still exports locally; automatic authenticated upload from the extension to this site is not part of this version.

### Internal Strava extension sync

Production accepts `POST /api/extension/activities` with `Authorization: Bearer <STRAVA_SYNC_SECRET>` and a JSON body containing `club_id: "2368312"` and 1–50 normalized activities. Keep the secret server-only; it is not a `NEXT_PUBLIC_*` variable. Database migration `202610140001_extension_sync.sql` creates a private hash configuration and a narrow import RPC. Configure the private hash and Vercel secret together. No service-role key is needed. This credential can only insert pending activities, with duplicate IDs skipped, at most 60 successful batches per minute. Raw source rows remain available for review; incoming points/status/notes/reviewer fields cannot grant approval. Admin/leader activity views refresh in the background every 60 seconds while visible and no review drawer is open.

The extension lives in the sibling `btn-tmg-strava-crawler-extension` directory. Reload its unpacked installation and Strava tab after updating. Enter the shared secret once, click **Lưu mã**, and use **Gửi lại** for an existing saved crawl. Upload errors preserve the checkpoint. The secret file under `exports/` is local, ignored and excluded from Vercel uploads; do not commit or distribute it. Shared-secret imports are audited as **Extension Strava**, not attributed to an individual admin.

Version 0.4.0 also syncs a complete club roster from the authenticated Strava Members page to `/api/extension/members`. This importer updates Strava source fields only, preserves assignments and account links, keeps absent members, and records aggregate counts in Audit. See the extension README for setup instructions.

Version 0.4.0 also syncs the complete Strava club roster from the authenticated Members page to `/api/extension/members`. The import updates only Strava source fields, preserves all assignments and account links, keeps absent rows, and records aggregate counts in Audit. See the extension README for use instructions.

### Portal routes and URL state

Authenticated pages share `src/app/(portal)/layout.tsx`: `/members`, `/activities`, `/audit`, `/groups`, `/accounts`, and `/division`. The shared `MemberPortal` owns auth, cached roster data, layout and assignment drawers; route pages render their own content through `PortalContext`. Navigation uses Next.js links, preserves the shared layout, and derives the active navigation item from the pathname. Accounts, Groups and Audit require admin; Division requires leader. Browser-side route guards complement the existing Supabase RLS/RPC checks, which remain authoritative.

`src/lib/portal-query.ts` defines nuqs parsers. Members use `q`, `division`, `page`, `size`; Activities use `q`, `status`, `division`, `page` (members also use `scope` and `group`); Accounts use `q`, `role`, `link`; Audit uses `q`, `action`, `page`. Defaults are omitted. Search replaces history with 300ms URL debounce and separately debounces client data queries. Filters are committed together only after drawer confirmation and reset page to 1; tab/filter/page navigation pushes history. Draft selection and edits remain local state. Invalid enum values fall back to defaults, and page requests beyond available data are corrected. Login retains a safe internal deep link and its queries. `/` still redirects to the public `/about` page.

### Home Screen app

`src/app/manifest.ts` defines a stable app ID `/`, start URL `/members`, scope `/`, and standalone display. Root metadata enables Apple's web app mode and uses a square 180px touch icon; the manifest provides square 192px and 512px icons. All internal navigation uses the same origin. External Strava links intentionally open outside the app. `/register` remains a shareable registration link.

Login and registration show a collapsible Home Screen guide on iPhone/iPad browsers, hidden when already running standalone. After deploying changed installation metadata, remove the old Home Screen shortcut and add the app again through Safari. Verify on a physical iPhone: launch from the new icon, log in, navigate through allowed routes, sign out and open registration; in-scope navigation should retain standalone presentation. Safari and the installed app can have separate sessions. Build and HTTP metadata checks do not verify the installed iOS experience.

### Signup confirmation by email OTP

Registration still creates a password-based account with profile metadata. After `signUp`, users remain on `/register` to enter a six-digit email code. `verifyOtp` uses `type: "email"` and establishes the session in the same browser/app before following the safe portal redirect. Login remains email and password.

`SignupOtpForm` supports one-time-code autofill, paste, actionable verification errors, a 60-second resend cooldown and changing the email. `resend` uses `type: "signup"`. Only pending email and send time are saved in session storage; passwords and OTPs are never persisted. Reloading resumes confirmation when browser storage is available.

Hosted Auth configuration uses `mailer_otp_length: 6`, `mailer_subjects_confirmation: "Mã xác nhận đăng ký REVIVE"`, and the contents of `supabase/templates/confirmation.html` as `mailer_templates_confirmation_content`. The template displays `{{ .Token }}` and has no confirmation link. Apply only these fields through the Supabase Management API or Auth email-template dashboard. `supabase/config.toml` records the scoped intent; CLI config diff/push may not include the hosted template body, so verify it separately. Preserve SMTP, confirmation requirements, expiry and existing rate limits. A config/build check does not prove email delivery; verify a real signup, newest-code resend and successful verification in the same installed app/browser.

### Incomplete discussion reports
Extension 0.5.0 also sends report posts to `/api/extension/posts` using the existing shared secret. Reports without embedded Activity data live in `club_incomplete_posts`, separate from scoreable activities, and appear under **Cần bổ sung**. Only title, author and post time are displayed; no title-derived steps, party size, points or approval controls are exposed. Successfully imported linked activities resolve the report on the next crawl. Reload the unpacked extension and Strava tab, then start a fresh crawl for older posts. Missing author IDs remain local and are reported in delivery details.

### Rankings
Authenticated users can view `/rankings`. `get_rankings` aggregates only approved Walk activities within the event period. Individual ranks use actual steps; group/division ranks use approved points attributed at review time. Dense ties share a rank. Participation counts distinct active roster members with their own approved activity, using current assignments; party sizes do not identify participants. Gender filters include only linked profiles with known gender. Weekly results use Monday–Sunday in Vietnam time. Milestone badges use approved lifetime event steps and distinct activity dates and are recalculated after reviews; seven days need not be consecutive. No account contact fields, birth years or review source/notes are exposed by the ranking RPC.

### Discussion kudos
Extension 0.6.0 reads `post.kudos_count` and `post.originator_name` from the club post feed. Post IDs, poster IDs, linked activity IDs and observation timestamps are sent through the existing `/api/extension/posts` endpoint and credential. `club_discussion_posts` stores current counts rather than accumulating receipts, and ignores older snapshots and author changes. Group/division attribution uses the first known roster assignment. `get_kudos_rankings` is authenticated and includes posts published during the selected event/week with at least one imported, in-period pending/approved Walk activity. Week filters publication time in Vietnam, not time kudos were given. Incomplete, rejected-only, non-Walk and unobserved posts are excluded. Counts never affect activity points. Reload the unpacked extension and Strava tab before starting a fresh crawl; old payloads remain compatible.

### Discussion media

Apply `202610150003_post_media.sql` for direct discussion photos. Extension 0.7.0 sends photo URL snapshots with existing post synchronization. Top Kudo and incomplete post cards share a decorative thumbnail and an accessible bottom drawer gallery with swipe, keyboard/arrow navigation, loading and error states. Images load directly from the Strava CDN; the app does not copy them into Storage. Existing post eligibility, review permissions and scoring are unchanged.

Activity cards and Top Kudo use the activity media columns from `202610150004_activity_media.sql`. Incomplete posts retain direct post photos. Importing a duplicate activity refreshes only media, never review/scoring fields. Apply `supabase/tests/activity_media.sql` as a rollback test for this behavior.

### Registration selections

Apply `202610150005_signup_selections.sql` for the registration group and Strava drawers. `get_signup_options` exposes only a bounded page of active, unlinked Strava names/IDs and group assignments to signup clients; emails, account IDs and BTN names are excluded. The form requires a group and a Strava account selected from the roster, with search and pagination. `validate_signup_selection` and the auth signup trigger preserve any existing roster group and save requested selections on the pending profile. Selecting a profile does not claim it or grant membership. Admin linking preselects the requested athlete, retains assigned groups and applies a requested group only to the same, currently unassigned athlete. OTP verification keeps the existing flow. Backend assertions in `supabase/tests/signup_selections.sql` roll back all fixtures without sending email.

### Registration review

Apply `202610150006_registration_review.sql` after signup selections. `/accounts` shows verified pending registrations and previously approved/linked accounts in separate tabs. The admin-only `approve_registration` RPC rechecks email verification, required profile fields and the selected roster account, then links it and records the reviewer, timestamp and audit event atomically. Repeated approval is idempotent; assigned groups, historical activities, points and existing roles are preserved. Legacy links remain approved without inventing historical approval dates. Email verification is mirrored from Auth using a restricted trigger; clients cannot set review fields directly. `supabase/tests/registration_review.sql` exercises the flow with rolled-back fixtures and no mail delivery.

### Social previews

Route metadata uses dedicated 1200×630 PNGs in `public/revive/og/`; the in-page banners stay 1920×1080. Regenerate the preview cards with `node scripts/generate-social-images.mjs` (requires network access to Google Fonts' official repository). This renders HTML/CSS with `next/og` and includes the existing logo and a Vietnamese call to action. Update image version names when changing artwork so new previews have a distinct URL. Metadata titles are descriptive, with the route first and REVIVE/organizer branding after it. `/about` introduces the full event; auth and portal copy describe the Strava walking tracker, with account creation rather than event enrollment. Descriptions stay within 125 characters. Auth and portal routes remain noindex; preview images contain generic branding only.


### Performance delivery

`20261015082420_activity_performance.sql` adds authenticated, bounded `get_review_activity_page` and `get_incomplete_post_page` RPCs. Review pages return 10 rows, global status counts and the existing approved total; filters/search/pagination run in PostgreSQL. Raw source, review notes and full detail rows load only when opening a review drawer. Inactive incomplete-post tabs request counts without media. Polling is 60 seconds, pauses while hidden, and refreshes when returning to the page; saving a review refreshes immediately.

Activity and ranking caches are memory-only, keyed by the actual session user and query, expire after 30 seconds, and are cleared on logout/account change or successful mutations. Epoch checks reject late responses, including logout and signing back into the same account. Run `node --test tests/activity-cache.test.mjs tests/portal-data.test.mjs` and the rolled-back database assertions in `supabase/tests/activity_performance.sql` for these boundaries.

The two RLS policies retain their existing permissions while using scalar session lookups. The audit history index supports action/entity/date queries; other advisory-only indexes on tiny tables are intentionally unchanged. The hosted migration was applied through the Supabase migration API because linked CLI dry-run is blocked by pre-existing local/remote migration-version drift. Do not repair or rewrite migration history as part of this change.

Card backgrounds use the imported Strava thumbnail when distinct. Existing snapshots that only contain a full photo use Next image optimization, restricted to the existing Strava CDN host with redirects disabled. Full gallery images keep their original CDN URL. No URL parameters are invented and no copies are stored in Supabase Storage. OG image filenames are versioned and use immutable browser caching; change filenames when replacing an image.

`vercel.json` places functions in `icn1`, beside the existing Seoul Supabase project. Static delivery remains on Vercel CDN. Speed Insights reports Web Vitals with query strings/fragments removed; browser User Timing entries named `supabase:rpc:<function>` record RPC fetch durations without query values, account identifiers, or response bodies. These timings include the network until response headers; they do not measure JSON parsing or database time alone.

Vercel Web Analytics runs once from the root layout alongside Speed Insights, using `@vercel/analytics/next`. It records page views and client navigation; the shared `beforeSend` callback strips query strings and fragments from event URLs. No account fields, form contents or custom user events are supplied by this integration. Web Analytics must be enabled for the Vercel project; view traffic under Analytics and performance under Speed Insights. Google Analytics and Search Console are not configured by this integration.

### Admin email notifications

Apply `202610170001_admin_notifications.sql`, `202610170002_admin_email_delivery.sql` and `202610170003_admin_email_worker_runtime.sql`. Verified registrations awaiting approval and new appeals create bell notifications plus a durable email outbox, with a separate delivery for every current, verified Admin email. Processing or deleting the underlying case cancels unsent deliveries; reading the bell does not. One reminder is scheduled 60 minutes after the initial email is accepted, only while the case remains pending. Existing activity approval events do not generate these emails.

Production requires server-only `RESEND_API_KEY`, `ADMIN_EMAIL_FROM` and a random `ADMIN_EMAIL_WORKER_SECRET` (32–200 characters). The sender is `REVIVE <notifications@strava.tmgchurch.website>`; verify the domain and scope the Resend sending key to it. Store the worker token in Supabase Vault as `admin_email_worker_secret`, and only its SHA256 hex digest in `private.admin_email_settings.worker_secret_hash`. The private worker URL points to the production `/api/notifications/email-worker` endpoint. Never use a `NEXT_PUBLIC_` variable for either secret or enable this configuration in previews.

Worker requests carry `Authorization: Bearer v1.<unix-seconds>.<hex-HMAC-SHA256>`, signing the timestamp with the worker secret; signatures expire after two minutes. The reusable token is never placed in pg_net's extension-owned queue, whose default public grants cannot be revoked by the hosted postgres role. The raw token is used only server-to-database for the narrow queue RPCs. The runtime migration also handles hosted safeupdate's explicit-WHERE requirement. Verify the actual Supabase-to-Vercel response after deployment, not just an empty disabled-worker response.

After deploying and successfully testing the sender against Resend's `delivered@resend.dev` test recipient, enable the private settings and schedule `select private.admin_email_tick();` every minute with pg_cron job name `revive-admin-email-delivery`. New notifications also wake the worker immediately; cron retries missed wake-ups and due deliveries. The dispatcher skips Vercel requests when no work is due. To pause sending, set `private.admin_email_settings.enabled=false`; keep the queue for resumption. Rotate the worker token in Vercel, Vault and the private digest together while paused.

Each worker claims at most five deliveries with five-minute leases, rechecks recipient permissions and case status, and freezes the rendered payload before sending. Retries reuse the same Resend idempotency key and payload. Exponential retries stop after 12 attempts or 23 hours to avoid crossing Resend's idempotency window. Failed jobs remain visible in the Admin bell's email health summary for investigation. `sent` means Resend accepted the email, not confirmed inbox placement; this integration does not receive bounce or delivery webhooks. Correct provider configuration before retrying a failed delivery, and investigate the stored provider ID before requeuing any ambiguous send.

Run `node --test tests/admin-email.test.mjs` for transport/idempotency behavior and `supabase/tests/admin_email_delivery.sql` as a rolled-back database test. The latter sends no emails and covers leases, retries, cancellation, reminders, authorization and recipient revocation. Do not use real Admin recipients for test fixtures.

### Admin Web Push

Apply `202610170004_admin_web_push.sql`. Web Push is an additional channel for verified Admin accounts, with separate per-device subscriptions and a durable push queue. Email settings and reminders remain independent. Push contains generic text and an authenticated deep link, without names, emails or appeal reasons on the lock screen. Pending cases created after device opt-in are eligible for six hours; only one queue job exists per event/device. At send time, the worker rechecks Admin permission and the current case status. Expired endpoints (404/410) are removed, transient failures retry up to eight attempts within six hours, and provider TTL is one hour. Stable topics and notification tags reduce duplicate displays after ambiguous retries; Web Push does not guarantee exactly-once delivery or confirm display on the phone.

Generate VAPID keys once with `web-push.generateVAPIDKeys()` and configure production server variables `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Never rotate the private key during routine deployment: existing subscriptions are tied to that key pair. Store only the public key in `private.admin_push_settings.public_key`. The worker uses the existing Vault worker secret and short-lived request signatures; the VAPID private key stays on Vercel. Enable the private push settings only after the worker is deployed. Schedule `select private.admin_push_tick();` every minute under job name `revive-admin-web-push`; immediate event wake-ups use the same dispatcher. No Vercel invocation occurs when no job is due. Pause using `private.admin_push_settings.enabled=false`.

On iPhone/iPad (iOS/iPadOS 16.4+), add the website to the Home Screen using Safari, launch that installed app, sign in as Admin, then open the bell and tap **Bật thông báo**. Permission is requested only from that gesture. The bell offers **Gửi thử** (one test per minute per device), its latest provider acceptance status and a per-device off button. Subscription endpoints and encryption keys are hidden from all direct client table access; only the device's owner can register, test or remove it. Up to ten devices per Admin are supported. Explicit sign-out removes the device subscription, unsubscribes the browser and closes displayed notifications; email remains active for the Admin account. Closing the app without signing out keeps push enabled.

`public/sw.js` handles notifications only, with no page/data caching or fetch interception. Clicks open only allowed same-origin routes. Subscriptions are limited to Apple's, Google's and Mozilla's public push endpoints; arbitrary URLs are rejected in both database and server code. The worker processes at most five devices concurrently with bounded network timeouts and lease-aware acknowledgements. Unit tests: `node --test tests/admin-push.test.mjs tests/admin-email.test.mjs`; rolled-back database assertions: `supabase/tests/admin_web_push.sql`. Physical iPhone validation still requires the user's permission, an installed Home Screen app and a real test from that device.

Extension 0.9.0 finalizes full discussion crawls through `/api/extension/posts/complete`. Only unresolved incomplete reports absent from the complete raw Post ID snapshot and last updated before the crawl began are archived (`missing_since`), never deleted. Both incomplete readers exclude archives. A later complete scan restores reappearing reports, while private scan history retains archived/restored IDs. A complete empty feed is supported, failed/partial crawls cannot finalize, and retries/older scans cannot override a newer completed scan. Existing reviewed activities, scores and Top Kudo remain unchanged. Reload the unpacked extension and Strava tab before using **Lấy mới** or **Gửi lại** on an already complete saved crawl.


Honors uses the same light, flat blue podium on mobile and desktop; gold/silver/bronze accents are limited to the winner icons. Desktop presentation retains native fullscreen, the pinned snapshot, name-before-count reveal sequence and Canvas confetti.
