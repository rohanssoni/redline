# Redline brief — resolved

Everything this file used to track as open is now settled. Decisions live as ADRs;
this file stays only for the method note below.

Resolved 2026-09-07:

- **The gap/flag contradiction did not require an amendment.** ADR-0005 stands as
  written: severity decides a gap's position in the list, never its type. A gap never
  becomes a citable flag regardless of severity. Confirmed, not changed.
- **Error preference** — Redline flags a citable clause even when confidence in the
  interpretation is partial, rather than staying silent. ADR-0006.
- **Uncertainty expression** — flags may use calibrated hedging language rather than
  stating plainly or being omitted. ADR-0007.
- **Clean documents** — a document with no flags gets a dedicated "this reads as
  normal" result, tracked via a zero-flag health metric. ADR-0008.
- **Counter-offer stance** — chosen by the reader per flag (soft or firm), defaulting
  to soft. Not a single fixed tone. ADR-0009.

Two of these (error preference, uncertainty expression) landed against the
recommendation that was on the table when this file was last written — see each ADR's
Alternatives section for why the recommendation didn't hold up.

## Method note

These decisions came out of a structured interview: each question forced a choice
between two things that couldn't both be had, and follow-up questions probed the
mechanics (scope, default) once an answer didn't fit either option offered. That shape
is worth keeping if the brief is picked up again — the value was in the questions that
named what was being given up, not in the ones that gathered requirements.
