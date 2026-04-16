# TweetClaw AI Engineering Rules

## Hard Rule

In `tweetClaw`, all real X/Twitter API operations must run in the `content` environment.

This is not a suggestion. It is a hard execution boundary.

## What Counts As "X/Twitter API Operations"

The following must stay in `content`:

- Any `fetch(...)` or `XMLHttpRequest(...)` to X/Twitter endpoints
- Any call to `https://x.com/...`
- Any call to `https://api.x.com/...`
- Any call to `https://upload.x.com/...`
- Any upload flow such as `INIT / APPEND / FINALIZE / STATUS`
- Any GraphQL mutation/query that depends on the live X web session
- Any logic that depends on page session credentials, cookies, csrf token, bearer token, transaction id, or injected page bridge state

## Allowed Responsibility Split

### `content`

`content` is the only real business executor for X/Twitter web-session operations.

It may:

- Read task input from `background`
- Build a local content session
- Access page/injection bridge state
- Call `twitter_api.ts`
- Call upload APIs
- Report progress/completed/failed/cancelled back to `background`

### `background`

`background` is only a coordinator.

It may:

- Receive `request.start_task`
- Download task input from Go REST endpoints
- Maintain background session cache
- Serve `GET_UPLOAD_SESSION_CHUNK`
- Dispatch work to `content`
- Receive `content -> background` task events
- Upload final result to Go
- Emit `event.task_*`

It must not:

- Call X/Twitter APIs directly
- Execute upload logic directly
- Pretend to be the X business executor

## Why This Rule Exists

Outside `content`, the code does not have the complete runtime conditions needed for X/Twitter web-session API calls.

Non-`content` environments do not reliably have:

- The page-side execution context
- The injected bridge used by TweetClaw
- The page-owned authenticated request behavior
- The correct live cookies/session behavior expected by X
- The same token and transaction-id generation context used by working browser flows
- The upload proxy path implemented through page/injection messaging

If an AI puts X API execution into `background`, it is almost certainly wrong.

## Environment Truth Table

### `tweetClaw/src/content/*`

This is the correct place for:

- X API calls
- Upload execution
- GraphQL mutations
- Session-bound browser actions

### `tweetClaw/src/capture/injection.ts`

This is part of the page bridge used by `content`.

It is allowed to support X operations indirectly for:

- Page-context proxying
- Upload proxy dispatch
- Captured request context

### `tweetClaw/src/service_work/*`

This is not allowed to execute X API calls.

It is only for:

- Coordination
- Session cache
- Message routing
- Go bridge interaction

### `tweetClaw/src/task/*`

Anything in this area must respect the same boundary.

- Coordination code may live here
- X executor code must not run here unless it is explicitly content-side code

If code under `src/task` directly calls X endpoints from non-`content`, it is wrong.

### Go / CLI / localBridge

These layers are task platform layers only.

They must not:

- Understand X upload internals
- Execute X API requests
- Replace `content` as executor

## Required Design Pattern For Long Tasks

For `x.media_upload`, the correct chain is:

1. Go creates task and stores input
2. `background` downloads input from Go
3. `background` stores a background session
4. `background` dispatches to `content`
5. `content` fetches chunks from `background`
6. `content` builds a content session
7. `content` executes X upload
8. `content` reports result to `background`
9. `background` uploads result to Go

## Prohibited Patterns

Do not implement any of these:

- `background` calling `fetch("https://upload.x.com/...")`
- `background` calling `fetch("https://x.com/...")`
- `background` directly performing `INIT / APPEND / FINALIZE / STATUS`
- Task executors in non-`content` code acting as X upload executors
- Go or CLI directly modeling X upload steps
- Skipping content session assembly and treating `background` session as the execution session

## Existing Good Anchors In This Repo

Use these files as the source of truth for the correct boundary:

- `tweetClaw/src/content/main_entrance.ts`
- `tweetClaw/src/content/content-task-runner.ts`
- `tweetClaw/src/content/content-upload-executor.ts`
- `tweetClaw/src/capture/injection.ts`
- `tweetClaw/src/x_api/twitter_api.ts`

Use this file as the source of truth for what `background` is allowed to do:

- `tweetClaw/src/service_work/background.ts`

## Decision Rule For Future AI Changes

Before writing any code involving X/Twitter:

1. Ask: "Will this code make a real X/Twitter request?"
2. If yes, it must execute in `content`
3. If the code is in `background`, Go, CLI, popup, debug, or any other non-`content` layer, stop and redesign

## Review Rule

If you are an AI reviewing a patch and you see X/Twitter API execution outside `content`, treat it as a design bug, not a style issue.

Reject or rewrite that design.
