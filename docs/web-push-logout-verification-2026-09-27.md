# Web push logout verification — 2026-09-27

- Reproduced with the actual client module and mocked browser/network: unsubscribing did not close delivered web notifications.
- Web logout now closes notifications returned by this site's service-worker registration after subscription deactivation/unsubscribe. Stale notifications are also closed when no subscription remains.
- Missing registrations or unsupported notification-list APIs remain safe no-ops. Server deactivation errors still reject cleanup and preserve the subscription for retry.
- No Supabase settings, database, notification permissions, or production deployment were changed by this fix.

## Verification

`node --test scripts/testAndroidIntegrations.mjs scripts/testNotificationIsolation.mjs`

27 tests passed, including four new regression tests for delivered-notification cleanup, stale notifications without a subscription, missing browser APIs, and deactivation failure.

These are mocked regression tests, not an operating-system notification or production logout verification. The fix requires a separately authorized production deployment before it can affect the live site.
