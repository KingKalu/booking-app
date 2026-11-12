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

- The only application manifest is `package.json`, configured for CommonJS.
- No application framework, source layout, database, or styling approach is
  established yet. Confirm these from project files before choosing conventions.
- Do not commit credentials or expose server-side API keys in browser code.

## Commands

No development, build, preview, lint, formatting, typecheck, or usable test
commands are configured yet. The current `npm test` script is a placeholder
that intentionally exits with an error; it is not a test runner or a test gate.
