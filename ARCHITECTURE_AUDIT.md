# WasteWise Technical Architecture Audit

**Audit date:** 2026-09-06  
**Repository:** `/home/ubuntu/wastewise`  
**Scope:** Frontend architecture, runtime behavior, deployment configuration, dependency posture, security boundaries, testability, and production readiness. The audit does not modify application code or assess an external backend because the current project is a static frontend.

## Executive conclusion

WasteWise is a strong **interactive prototype** with a coherent visual system and a complete demo flow, but it is not yet a production SaaS architecture. The current implementation is a client-only React application whose domain state is held in component memory. Role switching is a UI simulation rather than authentication, reports are not persisted, uploads are not stored, and the admin view has no server-enforced authorization. These constraints are acceptable for a hackathon demonstration, but they prevent reliable multi-user operation, auditability, offline recovery, and secure deployment.

The most important architectural change is to split the current monolithic UI into feature modules and introduce a server-backed domain layer. The domain should treat reports, bins, collection jobs, sanitation tasks, points, and users as persisted entities with explicit state transitions. A backend-for-frontend API should enforce role permissions and validate every mutation. The current static build can remain as the presentation layer while the runtime data path is migrated incrementally.

## Current architecture

| Area | Current implementation | Assessment |
|---|---|---|
| Presentation | React 19 + TypeScript + Vite + Tailwind CSS | Appropriate for the product surface and prototype stage. |
| Application shell | One `App.tsx` file containing layout, state, data, pages, and reusable components | Functional but high coupling and difficult to evolve safely. |
| Navigation | Local `studentPage`, `adminPage`, and `role` state | Works in-session but has no URL addressability, deep linking, browser history, or route guards. |
| State | Local React state shared only through the top-level component | Volatile and single-user. Refreshing the page loses changes. |
| Persistence | None | Reports, assignments, preferences, and points are not durable. |
| Authentication | Role switcher between “Student” and “Admin” | Demo-only. It is not authentication or authorization. |
| API/data access | None | All records and transitions are hard-coded or simulated in the browser. |
| Uploads | Browser file selection only; no upload or storage path | Images disappear after the session and are not available to administrators. |
| Maps | CSS-rendered illustrative campus map with simulated pins | Good for a prototype; not a geospatial integration. |
| Classification | Mock result after a timer | Correctly labeled as prototype behavior, but not an ML integration boundary yet. |
| Server | Express static-file server in `server/index.ts` | Adequate for serving a built SPA; it has no application API. |
| Validation | TypeScript compilation and production build | No unit, integration, accessibility, or end-to-end test suite. |

## Findings by priority

### Critical findings

| ID | Finding | Evidence | Impact | Recommendation |
|---|---|---|---|---|
| C-01 | There is no real authentication or authorization. | `role` is changed by a client-side button in `App.tsx`; no session, identity provider, token validation, or server permission check exists. | Any user who can load the app can display the admin workspace. A production admin action would be untrusted. | Add server-backed identity, session handling, and role-based authorization. Enforce permissions on every API mutation, not only in navigation. |
| C-02 | There is no durable domain data. | Reports, points, assignments, sanitation tasks, and preferences are initialized from arrays and held in React state. | Data disappears on refresh, cannot be shared across users, and cannot support reliable operational history or analytics. | Add a relational data model and API. Persist all business mutations with timestamps, actor IDs, and state-transition history. |
| C-03 | The product has no trusted workflow boundary. | `advance()` changes report status directly in the browser; collection assignment and sanitation progress are also local mutations. | A client can skip steps, assign unauthorized workers, forge points, or mark work resolved without verification. | Model transitions as server commands such as `assignReport`, `startCollectionJob`, and `resolveSanitationTask`. Validate the current state and caller role transactionally. |

### High findings

| ID | Finding | Evidence | Impact | Recommendation |
|---|---|---|---|---|
| H-01 | The application is architecturally monolithic. | `client/src/App.tsx` contains the application shell, domain types, seed data, every student page, every admin page, reusable UI, and mutation logic. | Changes have a large regression radius. Feature ownership, code review, lazy loading, and isolated testing are difficult. | Split into `app/`, `features/`, `components/`, `lib/`, and `types/`. Create separate modules for reports, bins, classification, rewards, and admin operations. |
| H-02 | Navigation is not URL-addressable. | Page selection uses local state rather than a router, despite `wouter` being installed. | Refreshing or sharing a page returns to the default overview. Back/forward behavior does not represent application state. | Add route definitions for student and admin areas. Add protected route boundaries and route-level code splitting. |
| H-03 | File uploads are not implemented end to end. | The report form stores only `fileName`; classification stores only a selected filename. | Operators cannot inspect evidence, classification cannot use the image, and upload behavior is misleading beyond the demo. | Add signed upload URLs or a managed storage integration, validate MIME type and size server-side, create attachment records, and return durable URLs with access control. |
| H-04 | There is no automated test coverage. | `package.json` has no test script, and the repository contains no application tests. | Core workflows can regress without detection. The current manual verification does not cover all role flows or responsive states. | Add unit tests for reducers and state transitions, component tests for forms, and browser tests for report submission, role access, and admin progression. |
| H-05 | Production bundle size is already high for a static dashboard. | The build produced a JavaScript asset of approximately 610 kB minified and emitted a Vite chunk-size warning. | Slower first load on campus networks and unnecessary transfer cost, especially on mobile. | Remove unused dependencies and generated UI primitives, split admin and student areas with dynamic imports, and set a performance budget in CI. |
| H-06 | Dependency governance is weak. | `pnpm audit --prod` reported 73 advisories: 17 high, 48 moderate, and 8 low. The manifest also includes many packages not imported by the active app. | Unnecessary packages increase supply-chain and maintenance exposure. Audit noise makes real vulnerabilities harder to triage. | Prune unused dependencies, update affected transitive packages, commit the lockfile after verification, and fail CI on agreed severity thresholds. Review `streamdown`, `axios`, `nanoid`, and Mermaid-related transitive paths in particular. |

### Medium findings

| ID | Finding | Evidence | Impact | Recommendation |
|---|---|---|---|---|
| M-01 | Package-manager configuration is inconsistent with the installed pnpm behavior. | `package.json` places `patchedDependencies` and `overrides` under the `pnpm` field, while the current pnpm output says that field is no longer read. | The declared patch and override policy may not be applied consistently across environments. | Move package-manager settings to the supported pnpm configuration format, validate with a clean install, and pin the package-manager version in CI. |
| M-02 | The production server is built even though the application is described as static. | `build` runs `vite build` and bundles `server/index.ts`; the server only serves static files and SPA fallback. | The deployment model is ambiguous. Teams may assume API capability that does not exist. | Choose one explicit model: deploy as a static site, or upgrade to a backend-enabled project and expose versioned APIs. Document the choice in the README. |
| M-03 | Error and loading states are incomplete for real network operations. | Current asynchronous behavior is limited to local timers and notifications. There are no request cancellation, retry, stale-data, or offline states. | A server-backed version would need predictable failure handling to avoid duplicate submissions and stale operational views. | Introduce a query/mutation layer with request IDs, optimistic-update rules, retries for safe reads, and explicit error boundaries per feature. |
| M-04 | Domain invariants are implicit rather than typed. | Status strings are repeated across components and advanced through nested conditional expressions. | New statuses or invalid transitions can create inconsistent UI and data. | Define enums or discriminated unions for report and sanitation workflows, plus a transition map and server-side validation. |
| M-05 | Accessibility and observability are not verified. | There is no automated accessibility check, structured telemetry, correlation ID, or audit log. | Accessibility regressions and operational failures may be invisible. | Add axe-based checks, keyboard-flow tests, error logging, performance telemetry, and actor/event audit records. |
| M-06 | Static demo data is coupled to UI copy. | Seed arrays and display labels live together in `App.tsx`. | Replacing demo data with API responses will require broad component edits. | Separate API/domain models from view models and keep formatting at the presentation boundary. |

## Security assessment

The current application has a low external attack surface because it does not accept server-side mutations. That should not be confused with production safety. The moment reports, images, users, or admin actions are connected to a backend, the current client-side role model becomes unsafe.

The minimum security baseline for the next architecture is as follows:

1. **Identity:** Use a managed identity provider or server-issued session. Do not treat a role selector or client state as proof of identity.
2. **Authorization:** Enforce least-privilege policies on the server. Students should only read their own reports and public campus data. Administrators should receive scoped operational permissions.
3. **Input validation:** Validate issue type, location, priority, status transitions, pagination, and attachment metadata on the server with a shared schema.
4. **Uploads:** Restrict file size and type, scan content where appropriate, store outside the application bundle, and serve through controlled URLs.
5. **Auditability:** Record who created, assigned, changed, and resolved each operational item. Do not rely on mutable display strings such as “Just now.”
6. **Abuse controls:** Add rate limits and duplicate detection for reports, especially if public or student-wide access is enabled.
7. **Transport and secrets:** Use HTTPS and keep storage, ML, maps, and identity credentials out of the client bundle. Vite’s environment guidance explicitly warns that production secrets require a backend or serverless boundary.[1]

## Recommended target architecture

```text
React/Vite web client
        |
        | HTTPS, session cookie or short-lived access token
        v
Backend-for-frontend API
        |
        +-- Identity and role policy
        +-- Report command service
        +-- Bin and sensor read service
        +-- Collection and sanitation workflow service
        +-- Rewards service
        +-- Classification adapter
        +-- Upload/signing service
        |
        +-- Relational database
        +-- Object storage for evidence images
        +-- Optional queue for notifications and sensor ingestion
        +-- Audit/event log
```

A practical first backend schema would include `users`, `campuses`, `campus_memberships`, `reports`, `report_attachments`, `bins`, `bin_readings`, `collection_jobs`, `collection_job_items`, `sanitation_tasks`, `points_ledger`, `badges`, and `audit_events`. Reports and tasks should reference stable IDs rather than display names. Sensor readings should be append-only or time-series records; the current fill percentage should be derived from the latest trusted reading.

The classification feature should be implemented behind an adapter interface. The browser should submit an attachment ID to a classification endpoint. The endpoint can initially return a clearly marked prototype result, then later call a real model without changing the page contract. The result should include `label`, `category`, `confidence`, `recommended_bin`, `model_version`, and `is_prototype`.

## Recommended frontend module structure

```text
client/src/
  app/
    App.tsx
    routes.tsx
    providers.tsx
  components/
    layout/
    feedback/
    data-display/
  features/
    reports/
      api.ts
      schemas.ts
      types.ts
      components/
      hooks/
    bins/
    classification/
    rewards/
    sanitation/
    analytics/
  lib/
    http.ts
    permissions.ts
    query-client.ts
    telemetry.ts
  pages/
    student/
    admin/
  types/
    domain.ts
```

The current `App.tsx` should become a thin composition root. Feature modules should own their forms, queries, mutations, and tests. Shared components should contain visual primitives only and should not know how reports or bins are persisted.

## Migration roadmap

| Phase | Objective | Deliverables | Exit criteria |
|---|---|---|---|
| 0 | Stabilize the prototype | Add route structure, split `App.tsx`, prune dependencies, normalize pnpm settings | TypeScript, production build, and browser smoke tests pass. |
| 1 | Establish identity and persistence | Add backend-enabled project, user/session model, database schema, report CRUD | A student can create and reload a report; an admin can see it under server authorization. |
| 2 | Secure workflows | Add transition commands, assignment rules, audit events, and server validation | Invalid client mutations are rejected; every change records actor and timestamp. |
| 3 | Add files and classification boundary | Add object storage, signed uploads, attachment records, and classification adapter | An uploaded image is durable, access-controlled, and associated with a report or classification. |
| 4 | Operationalize sensors and analytics | Add sensor ingestion, latest-reading views, collection jobs, background notifications, and materialized analytics | Admin metrics are derived from persisted data and remain consistent across sessions. |
| 5 | Production hardening | Add monitoring, accessibility testing, performance budgets, backup/restore, rate limits, and release checks | Deployment has measurable SLOs, alerting, rollback, and tested recovery procedures. |

## Verification performed

The current repository was checked with the following observations:

| Check | Result |
|---|---|
| TypeScript compilation | Passed with `pnpm check`. |
| Production build | Passed with `pnpm build`. |
| Preview smoke test | Student dashboard rendered successfully. |
| Report workflow | Report submission displayed a confirmation state. |
| Shared demo state | New report appeared in the admin overview after switching roles. |
| Responsive preview | Mobile dashboard rendered at 390 × 844. |
| Dependency audit | Reported 17 high, 48 moderate, and 8 low production advisories across 475 dependencies. |
| Test automation | Not present; this is a material production-readiness gap. |

## Final assessment

**Prototype readiness:** High. The current frontend is suitable for a hackathon demo and stakeholder walkthrough.

**Pilot readiness:** Low to moderate. A controlled pilot requires persistence, real identity, server authorization, durable uploads, and operational audit logs.

**Production readiness:** Low. The current static client cannot safely serve as the system of record for campus sanitation operations.

The recommended next move is not a wholesale rewrite. Preserve the existing visual product and workflow concepts, but refactor the frontend boundary first and then introduce a backend with explicit domain commands. This sequence reduces delivery risk while keeping the demonstrated product experience intact.

## References

[1]: https://vite.dev/guide/env-and-mode "Vite environment variables and modes"

[2]: https://vite.dev/guide/build "Vite building for production"

[3]: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html "OWASP Authentication Cheat Sheet"

[4]: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html "OWASP Authorization Cheat Sheet"

[5]: https://react.dev/learn/thinking-in-react "React Thinking in React"
