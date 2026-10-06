
# Phone Authentication → Google Authentication Migration

This document explains what actually happens to **existing users, profiles and
chats** when Trubond switches from Firebase Phone Auth to Google Sign-In, and
how the current code handles it.

---

## TL;DR — Do I need to reset the chats? Are old accounts deleted?

**No. Nothing is deleted, and you do not need to reset anything.**

Chats, posts, events, projects and profiles all live in **Cloud Firestore**,
which is completely independent of *how* a user signs in. Changing the sign-in
provider does not touch a single document in Firestore. Your data is safe.

### The one thing to be aware of

Phone Auth and Google Sign-In produce **different Firebase UIDs**.

| | Phone Auth | Google Sign-In |
|---|---|---|
| UID example | `K9x2mQa7ZpL...` | `N7bY3vR1tWc...` |
| Profile location | `users/<phone-uid>` | `users/<google-uid>` |

So when a student who originally signed up with their phone later signs in with
Google, Firebase issues them a **brand-new UID**. The app then looks for
`users/<new-google-uid>`:

* **If it exists** → normal sign-in, everything works.
* **If it doesn't exist** → they're sent to `/onboarding` to create a profile.

Their **old profile and old content are still in Firestore** under the old UID —
they are simply not linked to the new Google UID, so the user cannot *see* them
from the new login. **Nothing was lost or deleted; it just became unreachable
through the UI.**

---

## How this build handles it

The app ships with a **non-destructive email-match recovery** enabled by default.

When a signed-in Google user has no `users/<uid>` document, the auth provider
(`context/auth-provider.tsx`) does this:

1. Queries `users` where `email == <the Google-verified email>`.
2. If a legacy profile exists (created under a phone UID), it **copies** that
   document to the new Google UID (non-destructive `setDoc(..., { merge: true })`).
3. Tags it with `migratedFrom` / `migratedAt` for traceability.
4. The original `users/<old-phone-uid>` document is **left completely untouched**.

Because Google emails are verified and unique, this match is safe in practice.

```ts
// context/auth-provider.tsx
const ENABLE_EMAIL_PROFILE_RECOVERY = true; // set false for strict fresh start
```

### What the recovery restores vs. what it doesn't

| Item | Recovered automatically? | Notes |
|---|---|---|
| Profile (name, username, bio, branch, photo, stats) | ✅ Yes | Copied to the new UID |
| Username uniqueness lock (`usernames/{username}`) | ✅ Yes | Unchanged, still points at old UID (display only) |
| Global / branch / project **chats** | ✅ Yes | Chats are room-based, not user-based — fully accessible either way |
| Event registrations (`events/{id}/attendees/{oldUid}`) | ❌ Manual | Keyed by the old UID |
| Old posts (`posts` where `authorId == oldUid`) | ❌ Manual | Keyed by the old UID |
| Project membership arrays (old UID inside `members`) | ❌ Manual | Keyed by the old UID |

> **Important:** the recovery only copies the *profile* document. Content that
> references the user by UID (their posts, event attendee docs, project member
> arrays) still points at the legacy UID. This is intentional — rewriting
> references would be a destructive operation and we do **not** run it silently
> on login.

### If you want to fully migrate a specific user later

Write a small one-off script using the Admin SDK to re-point those references.
Example sketch:

```ts
// scripts/migrate-user.ts  (run with firebase-admin, never in the browser)
const OLD_UID = "...";
const NEW_UID = "...";

// 1. re-point authored posts
const posts = await db.collection("posts").where("authorId", "==", OLD_UID).get();
await Promise.all(posts.docs.map((d) => d.ref.update({ authorId: NEW_UID })));

// 2. re-point project membership
const projects = await db.collection("projects").get();
await Promise.all(projects.docs.map(async (d) => {
  if ((d.data().members ?? []).includes(OLD_UID)) {
    await d.ref.update({
      members: d.data().members.map((m: string) => (m === OLD_UID ? NEW_UID : m)),
    });
  }
}));

// 3. event attendee docs: copy then delete the old subcollection doc
//    const oldAttendee = db.doc(`events/${eventId}/attendees/${OLD_UID}`);
//    const newAttendee = db.doc(`events/${eventId}/attendees/${NEW_UID}`);
//    if ((await oldAttendee.get()).exists) {
//      await newAttendee.set((await oldAttendee.get()).data()!);
//      await oldAttendee.delete();
//      // then decrement events/{eventId}.attendeeCount
//    }
```

Always take a Firestore export/backup first.

---

## Firebase Console steps (required, not automated by code)

1. **Authentication → Sign-in method → Google → Enable**
   - Add a support email (required by Google).
2. **Authentication → Settings → Authorized domains**
   - Add `localhost` (for local dev) and your production domain
     (e.g. `trubond.netlify.app`).
3. *(Optional)* **Disable the Phone provider** once you're happy — the app no
   longer references it. Phone Auth also required reCAPTCHA and typically
   billing; Google Sign-In is free and needs no reCAPTCHA.

## Can I turn phone sign-in back on?

The OTP/reCAPTCHA UI is **not** part of the new React app. If you need it later,
re-enable the Phone provider in the console and add a sign-in option back into
`app/page.tsx` (`signInWithPhoneNumber` + `RecaptchaVerifier`). The rest of the
app is unaffected because everything keys off `users/{uid}`.