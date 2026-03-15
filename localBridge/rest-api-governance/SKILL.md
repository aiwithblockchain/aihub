---
name: rest-api-governance
description: Use when designing, adding, reviewing, or changing any LocalBridge or AIHub REST API. Applies to clawbot-facing HTTP endpoints, resource modeling, URI naming, HTTP methods, status codes, error shapes, pagination, filtering, and API versioning. Read the localBridge API design rules first and enforce them before coding.
---

# REST API Governance

Use this skill for any task that involves:

- designing a new REST API
- changing an existing REST endpoint
- reviewing whether an endpoint is RESTful
- exposing LocalBridge capability via HTTP
- writing API docs for `localBridge`

## Required first read

Before doing any design or code work, read:

- `../API_DESIGN_RULES.md`

Load this reference only when you need the external rationale:

- `references/microsoft-rest-summary.md`

## Workflow

1. Identify the resource.
2. Choose the URI using nouns and plural collection names.
3. Choose the HTTP method based on resource semantics.
4. Define request body, response body, and status codes.
5. Check pagination/filter/sort needs for collection endpoints.
6. Check whether the change is backward compatible.
7. Update API docs before or with code changes.

## Hard rules

- Do not use verbs in URI paths unless there is a documented exception.
- Do not model task execution as ad-hoc RPC when a `tasks` resource fits.
- Do not return `200` for every outcome.
- Do not invent a one-off error shape.
- Do not add or change an endpoint without aligning it to `../API_DESIGN_RULES.md`.

## Output requirements

When proposing or implementing an API, explicitly state:

1. resource model
2. URI
3. HTTP method
4. expected status codes
5. request/response shape
6. why it follows `../API_DESIGN_RULES.md`

## Review mode

If asked to review an API, prioritize findings in this order:

1. non-resource URI design
2. wrong HTTP method semantics
3. wrong or missing status codes
4. inconsistent error structure
5. missing pagination/filtering/versioning decisions
