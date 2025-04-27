# Captcha + anon sessions + upgrade to auth example app

Takes basic notes.

Requires hCaptcha before logging in or submitting a first
note in an anonymous sessions.

Upon logging in, will reparent notes from the anonymous
session to the authenticated session, leaving the anonymous
session empty again.

Uses the [sessions helper from Convex helpers](https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#session-tracking-via-client-side-sessionid-storage)
along with [custom functions](https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#custom-functions) to create nice application ergonomics re: switching between anon and logged in.

[Live demo](https://anon-notes.vercel.app)

## Notes

The logic about reparenting etc is all in `upgradeAnonUser`. You can
customize whether or not captcha needs to be satisfied before logging
in re: insisting on an anonymous user exists before creating an
authenticated one.

This demo uses hCaptcha and Clerk, so you need to go create accounts
there if you want to try it out.
