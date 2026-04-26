# LocalBridgeMCP

LocalBridgeMCP is the MCP adapter layer for LocalBridge.

It exposes LocalBridge capabilities as MCP tools for upstream MCP clients such as Claude Desktop, Cursor, and other agent products.

## Goals

- Keep platform-specific LocalBridge implementations unchanged as capability engines
- Add MCP support as a separate adapter layer
- Reuse existing LocalBridge APIs where possible
- Start with Apple LocalBridgeMac as the first connected platform
- Gradually expand toward a multi-platform LocalBridge MCP architecture

## Current Scope

First phase focuses on:

- MCP server bootstrapping
- LocalBridge REST adapter
- Initial X context/read/write tools
- Unified tool input/output structure
- Minimal governance features such as read-only mode and tool allowlist

## Prerequisites

Before running LocalBridgeMCP, make sure:

- A LocalBridge platform service is running
- The LocalBridge API is reachable
- At least one tweetClaw instance is connected if you want to test X tools
- X/Twitter is logged in if you want to use account-specific tools

## Project Structure

```text
src/
  config/
  server/
  adapters/
  tools/
  schemas/
  errors/
  logging/
  utils/
```

## Development

Install dependencies:

```bash
npm install
```

Run in development mode:

```bash
npm run dev
```

Type check:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

Run built output:

```bash
npm run start
```

## Configuration

The MCP server uses its own configuration and connects to LocalBridge via HTTP.

Planned core config fields include:

- `localbridgeBaseUrl`
- `enabledTools`
- `readOnlyMode`
- `defaultInstanceId`
- `requestTimeoutMs`
- `debugLogging`
- `exposeRawPayload`

## First Milestone

The first milestone is to make the MCP server boot and successfully expose a working `list_x_instances` tool backed by the existing LocalBridge X instances API.
