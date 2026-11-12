# Booking

## What this is

A clinic appointment booking API and patient-facing page. The API contract and
product requirements are in [fsd.md](fsd.md). Follow that contract exactly.

## Engineering principles

- Build only for established requirements; prefer the smallest reversible design.
- Validate untrusted input and preserve booking integrity at persistent-data
  boundaries.
- Do not add dependencies, abstractions, or configuration without a current need.
- Preserve existing behavior and verify changes with the checks this project has.

## Project conventions

- Next.js App Router with TypeScript; use server components for server-rendered
  data and client components only for interactive behavior.
- MongoDB is the persistent source of truth. Access it from server code only.
- Do not commit credentials or expose server-side API keys in browser code.
- The exact API contract is in `fsd.md`; preserve its routes, fields, response
  shapes, and status codes.

## Commands

- Dev server: `npm run dev` (http://localhost:3000)
- Build: `npm run build`
- Production server: `npm run start`
- Typecheck: `npm run typecheck`

No test runner, lint, or formatting command is configured.
