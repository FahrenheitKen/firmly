# Changelog

All notable changes to Firmly (law firm ERP) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Bumping rules for this repo:

- **MAJOR** — breaking REST API change, breaking DB schema change without auto-migration, removed permission, removed module.
- **MINOR** — new module / endpoint / permission / optional field. Backwards-compatible.
- **PATCH** — bug fix, copy change, dependency bump, perf fix. No behavior change for callers.

## [Unreleased]

## [1.0.0] - 2026-05-20

First production MVP.

### Added

- **Multi-tenant business model** with per-business location/branch scoping and an active-location switcher in the sidebar.
- **Role and permission system** (Spatie) with owner role, `case.view_all` / `case.view_own`, `business_settings.*`, `user.*`, `task.*` permissions.
- **Cases module** — create, edit, list, detail view; recovery flag; opposing counsel; case numbers and references; per-location scoping.
- **Case documents** — upload, list, download per case.
- **Case events / calendar** — Bring Up, Mention, Hearing, Ruling, Judgement event types; calendar view on dashboard; click-through to case; "assigned to" shown for users who can see all cases.
- **Case emails** — link an email account, send and view threaded email from inside a case.
- **Court proceedings** — record proceedings with auto-generated Bring Up and due-for events.
- **Clients** — individual and business client types, contact details, references.
- **Tasks** — assignment, due dates, status, scoped by view permission.
- **Users / staff** — full profile (bank details, role, location permissions), invite-and-login flow.
- **Locations / firm branches** — CRUD, active/inactive toggle, per-user location permissions.
- **Email accounts** — Gmail and Zoho OAuth connect flows for staff inboxes.
- **Notifications** — in-app bell with poll-based updates, desktop notifications, sound ding for new events.
- **Auth** — register, login, forgot/reset password, 2-hour idle auto-logout, Sanctum token sessions.
- **Dashboard** — month calendar of upcoming case events with per-event-type colour legend.

### Infrastructure

- Laravel 12 backend + Next.js 16 / React 19 frontend.
- Nginx + php-fpm 8.2 in production; frontend served via systemd `firmly-frontend.service` on port 3001.
- Shared `LocationsProvider` on the client so `/locations` is fetched once per session.
