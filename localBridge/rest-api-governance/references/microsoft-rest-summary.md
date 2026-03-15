# Microsoft REST Summary

This file is a short working summary of the Microsoft Learn article on RESTful Web API design best practices.

Primary source:

- <https://learn.microsoft.com/zh-cn/azure/architecture/best-practices/api-design>

## What to carry into LocalBridge

### Resource-first design

- Design APIs around resources.
- Use nouns for URIs.
- Use plural nouns for collections.
- Keep URI relationships simple.

Examples:

- Good: `/orders`
- Avoid: `/create-order`

### HTTP method semantics

- `GET`: retrieve a resource
- `POST`: create a resource in a collection, or submit processing
- `PUT`: replace a resource; should be idempotent
- `PATCH`: partially update a resource
- `DELETE`: remove a resource

### Status codes

Microsoft’s guidance highlights these common patterns:

- `200 OK`
- `201 Created`
- `204 No Content`
- `400 Bad Request`
- `404 Not Found`
- `405 Method Not Allowed`
- `409 Conflict`
- `415 Unsupported Media Type`

### Pagination and filtering

- Use query parameters for pagination and filtering.
- Typical pagination parameters: `limit`, `offset`
- Apply meaningful defaults.
- Apply a server-side upper bound to avoid abuse.

Example:

- `GET /orders?limit=25&offset=50`

### Versioning

The Microsoft article discusses:

- URI versioning
- query-string versioning
- header versioning
- media-type versioning

For LocalBridge, the chosen rule is:

- use URI versioning: `/api/v1/...`

### Why this matters for LocalBridge

LocalBridge will expose APIs to `clawbot`.

That means the API must be:

- stable
- predictable
- machine-friendly
- easy to document

So even when the service runs locally, the API should still behave like a disciplined REST API rather than a loose RPC surface.
