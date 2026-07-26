---
name: hogwarts-nexus
description: Use for any work on the Hogwarts Nexus Lumiére platform — a responsive Next.js + Tailwind + FastAPI (Python) rewrite of the Stitch-generated Lumiére design. Covers views (Dashboard, Inbox, Borgin & Burkes, Treasure Chamber, El Quisquilloso, Flourish & Blotts, Pet Sanctuary, Social Profile), the Zerines (fake 💎) economy, and admin vs. user role-based CRUD for all entities.
metadata:
  project: hogwarts-nexus-lumiere
  stack: next.js, tailwind, fastapi, python
  source: stitch-export
---

## What this skill is for

This is the **project memory** for Hogwarts Nexus Lumiére. Load it whenever you work on any file in this repo. It tells you the design system, the list of views to replicate, the economy rules, and the role model. The full design inventory lives in `DESIGN.md` at the repo root and in each `stitch_*/<view>/code.html`; this SKILL.md is the fast index.

## Stack (target)

- **Frontend**: Next.js (App Router, TypeScript) + Tailwind CSS v3 + Material Symbols + Google Fonts (EB Garamond, Hanken Grotesk, JetBrains Mono)
- **Backend**: Python + FastAPI (async) + SQLAlchemy + PostgreSQL (or SQLite for dev) + Alembic migrations
- **Auth**: JWT (admin role vs. user role). No real money — Zerines 💎 are just an integer on the user row.
- **Responsive**: Desktop (sidebar + top tabs) collapses to mobile (bottom nav + top app bar). Use Tailwind breakpoints `md:` / `lg:`.

## Design system (Lumiére) — quick reference

- Palette: `primary` navy `#0e3b60`, `secondary` gold `#775a19`, `secondary-container` `#fed488`, `surface` `#fcf9f8`, `error` `#ba1a1a`. Dark zone for Borgin & Burkes only (`inverse-surface` `#313030`).
- Typography: EB Garamond (display/headline), Hanken Grotesk (body/title), JetBrains Mono (labels, Zerines amounts).
- Components: `.glass-card` (white 70% + `backdrop-blur 12px`), `.crystal-gradient` (135deg blue→gold) for Treasury hero, `.parchment-edge` (clip-path torn paper) for The Quibbler, `.borgin-card` (near-black + gold border + glow on hover).
- Icons: Material Symbols Outlined, weight 1.5–2px, `diamond` icon = Zerines 💎.
- Zerines 💎 are fake money — an integer column, no payment gateway. Buying decrements the buyer and credits the seller (or the system).

## Views to replicate (exact match to the Stitch HTML)

Each view has desktop and mobile variants — **the final app is ONE responsive page per view, not two**. Replicate the desktop layout at `lg+` and the mobile layout below `md`, sharing data and components.

1. **Dashboard** — `hogwarts_nexus_dashboard_es` / `dashboard_de_gesti_n_m_vil` → `/` (admin: KPIs + admins + creatures + marketplace preview; user: personal KPIs).
2. **Bandeja de Entrada (Owlery)** — `bandeja_de_entrada_*` → `/messages` (3-pane desktop / single-pane-with-modal mobile; realtime messages between users).
3. **Borgin & Burkes** — `borgin_burkes_*` → `/marketplace/borgin-burkes` (dark zone; product grid + cart + ticket receipt; admin can CRUD products).
4. **Cámara del Tesoro** — `c_mara_del_tesoro_*` → `/treasury` (crystal hero with balance, deposit/withdraw/transfer tabs; admin sees global treasury, user sees own balance).
5. **El Quisquilloso** — `el_quisquilloso_*` → `/news` (parchment cards; admin can publish/edit/delete articles; user reads).
6. **Flourish & Blotts** — `flourish_blotts_*` → `/marketplace/flourish-blotts` (bookstore; buy with Zerines; admin manages catalog).
7. **Santuario de Mascotas** — `santuario_de_mascotas_*` → `/pets` (creature cards with feeding/playing status bars; feed/play costs Zerines; admin breeds/creates).
8. **Perfil social (con amigos)** — `perfil_de_usuario_social_*` → `/profile/[id]` (avatar, friends list, posts, activity; user owns profile; admin can moderate).
9. **Perfil con mensajería directa** — `perfil_de_usuario_con_mensajer_a_directa_es` → folded into `/profile` + `/messages`.
10. **Gestión admin (CRUD)** — NOT in the Stitch export. Must be built: admin → `/admin/{users, products, articles, creatures, transactions}` for insert/update/delete on every entity. Protected by `role=admin`.

## Roles

- **user** (consumer): spends/earns Zerines, sends messages, owns pets, posts.
- **admin** (operator): everything a user can do PLUS CRUD on every entity + sees the global KPI dashboard at `/`.

## When to use me

- Anytime you create or edit a file under `frontend/`, `backend/`, or `design/`.
- Anytime you need the canonical list of views, the palette, or the role rules.
- Before generating a new component: check the matching `stitch_*/*/code.html` first and mirror its structure.

## Related

- Global skill: `graphify` — run `/graphify` over the repo once code exists to get a navigable knowledge graph of the codebase.
- `PLAN.md` at the repo root holds the step-by-step execution plan.
- `DESIGN.md` is the canonical design system.
