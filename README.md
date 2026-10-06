# Trubond — College Networking Platform 🎓

<div align="center">

![Trubond](https://img.shields.io/badge/Trubond-College_Networking_Platform-blue?style=for-the-badge)
![Version](https://img.shields.io/badge/Version-2.0.0-green?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge)
![Firebase](https://img.shields.io/badge/Backend-Firebase-orange?style=for-the-badge)
![Auth](https://img.shields.io/badge/Auth-Google_Sign--In-4285F4?style=for-the-badge)

**Enterprise-Grade Campus Connectivity Solution**

</div>

## 🚀 Overview

Trubond is a campus social platform for students: a feed, real-time group chat,
project team-ups with join requests, events with QR ticketing, and QR-based
attendance verification.

**Version 2.0 is a full rewrite** of the original vanilla HTML/JS site. It now
runs on **Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui**,
and sign-in is **Google-only** (Phone Auth has been fully removed).

> 🔐 **Migrating from Phone Auth?** Read **[GOOGLE_AUTH_MIGRATION.md](./GOOGLE_AUTH_MIGRATION.md)**
> — it explains exactly what happens to existing users, posts and chats.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 3 + shadcn/ui (Radix UI primitives) |
| Auth | Firebase Authentication — **Google Sign-In** (popup) |
| Database | Cloud Firestore (real-time `onSnapshot`) |
| Storage | **Cloudinary** — unsigned browser uploads (see below) |
| QR | `qr-code-styling` (tickets) + `jsqr` (scanner) |
| Toasts | `sonner` |
| Theming | `next-themes` — light / dark / system toggle |
| Animation | `lottie-react` + small hand-authored brand animations |
| Icons | `lucide-react` |
| Search | `cmdk` command palette — **Ctrl/Cmd + K** |
| Presence | Firestore heartbeat (`lib/services/presence.ts`) |
| PWA | hand-written service worker + offline fallback |
| Feed ranking | client-side scoring (`lib/services/feed.ts`) |
| Pagination | cursor-based via `startAfter` (`lib/services/pagination.ts`) |

## 🚦 Getting Started

```bash
npm install
cp .env.local.example .env.local   # fill in your Firebase web config
npm run dev                        # http://localhost:3000
```

Other scripts:

```bash
npm run build       # static export to ./out
npm run start       # serve the production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run check:theme # fails on light-only colours (dark-mode regression guard)
```

### Environment variables

All are public client-side identifiers (not secrets). Copy
`.env.local.example` → `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# File uploads (Cloudinary) — see "File Uploads" below
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=

# Only used by the legacy vanilla site (home.js); not needed for v2
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
```

## ☁️ File Uploads (Cloudinary)

Profile photos, post images and chat attachments are uploaded straight from the
browser to **Cloudinary** — Firebase Cloud Storage is no longer used. Because
the app is a static export (`output: "export"`) there is no backend available to
sign uploads, so this uses an **unsigned upload preset**.

Setup:

1. Create a free account at [cloudinary.com](https://cloudinary.com).
2. Copy your **Cloud name** from the Dashboard.
3. **Settings → Upload → Upload presets → Add upload preset**, set
   **Signing Mode = `Unsigned`**, and note the preset name.
4. Put both values in `.env.local` and restart the dev server.

> ⚠️ An unsigned preset is publicly callable. Harden it: set a **max file size**
> (~10 MB), restrict **allowed formats** (`jpg,png,webp,gif,pdf`) and leave the
> preset's **Folder** field empty so the app's dynamic folders are used.

Uploads are implemented in `lib/services/storage.ts`. The public helpers
(`uploadProfilePhoto`, `uploadPostImage`, `uploadChatFile`) keep the same
signatures they had with Firebase, so no calling code needed to change.

**Existing images keep working** — Firebase download URLs already stored in
Firestore are absolute, so old posts and avatars still render. Only new uploads
go to Cloudinary.

## ✅ Required console setup

These cannot be done from the codebase and the app will partially fail without
them.

### 1. Cloudinary upload preset

**Settings → Upload → Upload presets → your preset:**

| Setting | Value |
|---|---|
| Signing Mode | **Unsigned** (required — uploads fail without it) |
| Allowed formats | `jpg,jpeg,png,webp,gif,pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,zip` |
| Max file size | `25000000` (25 MB, to match `CHAT_UPLOAD_POLICY` / `NOTE_UPLOAD_POLICY`) |
| Folder | leave **empty** so the app's dynamic folders are used |

PDF and ZIP delivery is **blocked by default** on Cloudinary — enable it under
**Settings → Security → Allow delivery of PDF and ZIP files**, or those uploads
will succeed and then 404 when downloaded.

### 2. Firestore composite indexes

`firestore.indexes.json` lists them. Firestore prints a one-click creation link
in the console when a query needs a missing index.

| Collection | Fields |
|---|---|
| `posts` | `authorId` ASC, `createdAt` DESC |
| `projects` | `members` CONTAINS, `createdAt` DESC |
| `notifications` | `recipientId` ASC, `createdAt` DESC |

### 3. Firestore security rules

[firestore.rules](firestore.rules) is the reviewed ruleset. Deploy it with:

```bash
firebase deploy --only firestore:rules
```

**The key idea:** several actions write to a document the acting user does *not*
own. Liking a post writes `posts/{id}.likeCount`; following someone writes
`users/{them}.followerCount`. Batches are atomic, so denying that one write kills
the whole action — which is what made likes and comments fail.

Each such rule therefore permits an update only when the changed keys are
**exactly** the counter fields:

```
request.resource.data.diff(resource.data).affectedKeys()
  .hasOnly(['likeCount', 'commentCount', 'viewCount'])
```

That lets anyone move a counter while still preventing them from editing content
or ownership.

**Known trade-off:** with no server (no Cloud Functions on a static export),
follower/following counts are technically inflatable by a determined client.
Validating them server-side would require a backend.

Collections that need rules and are easy to forget when adding a feature:
`follows/`, `notifications/`, `notes/` (+ `upvotes` / `comments`). Without a
matching `match` block they fall through to the default deny.

## 🔐 Enabling Google Sign-In

1. Firebase Console → **Authentication → Sign-in method → Google → Enable**
## 🏗️ Project Structure

```
app/
├── layout.tsx                  # fonts, AuthProvider, Toaster
├── page.tsx                    # "/" — Google sign-in screen
├── onboarding/page.tsx         # profile creation (unique username)
├── (app)/layout.tsx            # auth guard + app shell (sidebar/header)
│   ├── home/page.tsx           # feed: create / like / comment / delete posts
│   ├── chat/page.tsx           # real-time chat (text, files, polls)
│   ├── groups/page.tsx         # global / branch / project groups
│   ├── events/page.tsx         # events, registration, QR tickets
│   ├── projects/page.tsx       # projects, join requests, members
│   ├── profile/page.tsx        # profile, stats, posts/projects/events
│   └── scan/page.tsx           # QR ticket scanner (jsQR)

components/
├── ui/                         # shadcn/ui primitives (button, card, dialog,
│                               # avatar, tabs, scroll-area, dropdown-menu…)
├── layout/app-shell.tsx        # sidebar, header, auth guard, mobile nav
├── feed/                       # post-composer, post-card, comments-dialog
├── chat/                       # chat-client, poll-message, create-poll-dialog
├── projects/                   # project-card, create/manage dialogs
├── events/                     # event-card, create-event, qr-ticket dialog
├── profile/edit-profile-dialog.tsx
└── shared/empty-state.tsx

lib/
├── firebase.ts                 # modular SDK init (app/auth/db/storage)
├── utils.ts                    # cn(), formatters, helpers
├── constants.ts                # branches, nav items
└── services/                   # typed data-access layer
    ├── users.ts  posts.ts  projects.ts  events.ts  chat.ts  storage.ts

context/auth-provider.tsx       # auth state + profile + email-match recovery
types/index.ts                  # UserProfile, Post, Project, Event, ChatMessage…
```

## 💾 Firestore Data Model (unchanged from v1)

```
users/{uid}                             profile + stats
usernames/{username}                    { userId } — uniqueness lock
posts/{postId}                          text, imageUrl, like/comment/view counts
posts/{postId}/comments/{commentId}
posts/{postId}/likes/{uid}
projects/{projectId}                    members[], skillsRequired[], membersNeeded
projects/{projectId}/requests/{reqId}   { userId, username, status: "pending" }
events/{eventId}                        date, location, maxAttendees, attendeeCount
events/{eventId}/attendees/{uid}        { joinedAt }
global_chat/{roomId}/messages/{msgId}   global live chat
branch_chats/{roomId}/messages/{msgId}  department chat
project_chats/{roomId}/messages/{msgId} per-project chat
```

Because the collection layout is preserved, **your existing data keeps working
without any migration script**.

## ✨ Features

- **Auth** — Google Sign-In, guarded routes, profile onboarding with live
  username availability check
- **Feed** — real-time posts with images, likes, comments, view counts, edit/delete
- **Projects** — create, skills tags, join requests, approve/deny, member lists
- **Events** — create, capacity limits, transactional registration, QR tickets
- **Chat** — real-time channels, file attachments, in-chat polls with voting
- **Scanner** — camera-based QR ticket verification with attendee validation
- **Profile** — stats, bio editing, tabs for posts / projects / events
- **UI** — responsive, dark-mode-ready theme, toasts, skeletons, empty states

## 📄 Legacy Code

The original vanilla files (`index.html`, `home.html`, `home.js`, `home.css`,
`create.html`, `scan.html`) are kept at the repo root for reference/rollback.
They are **not** part of the Next.js build — Next serves from `app/` and assets
from `public/`. You can delete them once you're happy with v2.

## 🚀 Deployment

`next.config.mjs` uses `output: "export"`, so `npm run build` writes a fully
static site to **`out/`**. Point your host (Netlify/Vercel/GitHub Pages) at:

- **build command:** `npm run build`
- **publish directory:** `out`

To run server-side instead, delete `output: "export"` from `next.config.mjs`.

## 📄 License

MIT License — full commercial and institutional use permitted.

---
