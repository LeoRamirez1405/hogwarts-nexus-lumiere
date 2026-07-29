# Hogwarts Nexus Lumiere - Implementation Plan

## Architecture Overview

Full-stack responsive web platform: **Next.js 14 (App Router) + Tailwind CSS** frontend, **Python FastAPI + SQLAlchemy** backend. Single monorepo with `frontend/` and `backend/` directories.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 3.4 |
| State | Zustand (client), React Server Components (server) |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), Alembic |
| Database | SQLite (dev), PostgreSQL (prod) |
| Auth | JWT (jose) + bcrypt, role-based (`admin` / `user`) |
| API Docs | OpenAPI 3.0 (auto from FastAPI) |
| Icons | Material Symbols Outlined (Google Fonts) |
| Fonts | EB Garamond, Hanken Grotesk, JetBrains Mono (Google Fonts) |

### Directory Structure

```
Nexus/
  frontend/                    # Next.js 14 App Router
    app/
      layout.tsx               # Root layout (fonts, providers, metadata)
      page.tsx                 # Redirect to /dashboard
      (auth)/
        login/page.tsx
        register/page.tsx
      (main)/                  # Authenticated layout group
        layout.tsx             # AppShell (sidebar + header + bottom nav)
        dashboard/page.tsx
        messages/page.tsx
        marketplace/
          borgin-burkes/page.tsx
          flourish-blotts/page.tsx
        treasury/page.tsx
        news/page.tsx
        pets/page.tsx
        profile/
          [id]/page.tsx
        admin/
          layout.tsx           # Admin sub-layout with sidebar
          users/page.tsx
          products/page.tsx
          articles/page.tsx
          creatures/page.tsx
          transactions/page.tsx
    components/
      layout/
        AppShell.tsx           # Main layout shell (sidebar + header + bottom nav)
        Sidebar.tsx            # Left sidebar navigation
        TopBar.tsx             # Fixed top header bar
        BottomNav.tsx          # Mobile bottom navigation
      ui/
        GlassCard.tsx          # Glassmorphism card (default/tinted/dark variants)
        Avatar.tsx             # Sized avatar with border + status dot
        Badge.tsx              # Status pill (active/count/tag/date-separator)
        Button.tsx             # Primary/secondary/ghost/crystal button variants
        SearchBar.tsx          # Rounded search input with icon
        Modal.tsx              # Overlay modal with backdrop-blur
        ProgressBar.tsx        # Segmented fill bar (pet stats, goals)
        TabGroup.tsx           # Pill-shaped tab switcher
        ZerineDisplay.tsx      # Currency display (balance/price/delta, sm-md-lg-hero)
        FAB.tsx                # Floating action button
        LanguageSelector.tsx   # Language dropdown (5 languages)
      domain/
        Dashboard/
          KpiCard.tsx
          ActivityFeed.tsx
          QuickNav.tsx
        Owlery/
          ConversationList.tsx
          ChatPanel.tsx
          MessageBubble.tsx
        BorginBurkes/
          ArtifactCard.tsx
          CartSidebar.tsx
          TicketReceipt.tsx
        Treasury/
          CrystalHero.tsx
          TransactionList.tsx
          TransferForm.tsx
        Quisquilloso/
          NewspaperMasthead.tsx
          FeaturedArticle.tsx
          ForumThread.tsx
        FlourishBlotts/
          BookCard.tsx
          BookRecommendations.tsx
        PetSanctuary/
          CreatureCard.tsx
          PetInventoryCard.tsx
          StatsPanel.tsx
        Profile/
          ProfileHeader.tsx
          FriendsGrid.tsx
          PostFeed.tsx
          DirectMessages.tsx
        Admin/
          CrudTable.tsx
          CrudForm.tsx
    lib/
      api.ts                   # API client (fetch wrapper)
      auth.ts                  # JWT helpers, useAuth hook
      types.ts                 # Shared TypeScript types
    stores/
      authStore.ts             # Zustand auth state
      cartStore.ts             # Borgin cart state
      themeStore.ts            # Theme/language state
    styles/
      globals.css              # Tailwind directives + custom CSS classes
    tailwind.config.ts         # Design system tokens
    next.config.ts
  backend/
    app/
      main.py                  # FastAPI app + CORS + router mount
      config.py                # Settings (env vars, DB URL, JWT secret)
      database.py              # SQLAlchemy async engine + session
      models/                  # SQLAlchemy ORM models
        user.py                # User (id, name, email, hash, role, zerines)
        product.py             # Product (id, name, price, category, stock, image, shop)
        article.py             # Article (id, title, body, author, category, image)
        creature.py            # Creature (id, name, rarity, price, hunger, happiness)
        user_creature.py       # UserCreature (user_id, creature_id, level)
        message.py             # Message (id, sender_id, receiver_id, body, read)
        post.py                # Post (id, author_id, body, image, likes)
        transaction.py         # Transaction (id, user_id, type, amount, description)
      schemas/                 # Pydantic request/response models
        user.py
        product.py
        article.py
        creature.py
        message.py
        post.py
        transaction.py
      routers/                 # FastAPI routers
        auth.py                # POST /auth/login, /auth/register
        users.py               # CRUD /users
        products.py            # CRUD /products (Borgin + Flourish)
        articles.py            # CRUD /articles
        creatures.py           # CRUD /creatures + adopt/feed/play
        messages.py            # CRUD /messages + conversations
        posts.py               # CRUD /posts + likes
        transactions.py        # GET /transactions, POST /transfer, /deposit, /withdraw
        dashboard.py           # GET /dashboard (admin KPIs + user stats)
      middleware/
        auth.py                # JWT verification middleware
        roles.py               # Role-based access decorator
    alembic/
      versions/                # DB migrations
    requirements.txt
```

---

## Design System Tokens (Tailwind Config)

All colors, typography, spacing, and shapes from DESIGN.md mapped to Tailwind:

### Colors
```typescript
colors: {
  primary: { DEFAULT: '#0e3b60', container: '#2b5278', fixed: '#d0e4ff', 'fixed-dim': '#a4caf6' },
  'on-primary': { DEFAULT: '#ffffff', container: '#a0c5f1', fixed: '#001d35', 'fixed-variant': '#21496f' },
  secondary: { DEFAULT: '#775a19', container: '#fed488', fixed: '#ffdea5', 'fixed-dim': '#e9c176' },
  'on-secondary': { DEFAULT: '#ffffff', container: '#785a1a', fixed: '#261900', 'fixed-variant': '#5d4201' },
  tertiary: { DEFAULT: '#36393c', container: '#4d5053', fixed: '#e0e2e6', 'fixed-dim': '#c4c7ca' },
  surface: { DEFAULT: '#fcf9f8', dim: '#dcd9d9', bright: '#fcf9f8', container: { DEFAULT: '#f0eded', low: '#f6f3f2', high: '#eae7e7', highest: '#e5e2e1', lowest: '#ffffff' } },
  'on-surface': { DEFAULT: '#1c1b1b', variant: '#42474e' },
  outline: { DEFAULT: '#73777f', variant: '#c2c7cf' },
  error: { DEFAULT: '#ba1a1a', container: '#ffdad6', 'on-error': '#ffffff', 'on-error-container': '#93000a' },
  inverse: { surface: '#313030', 'on-surface': '#f3f0ef', primary: '#a4caf6' },
}
```

### Typography
```typescript
fontFamily: {
  display: ['EB Garamond', 'serif'],
  body: ['Hanken Grotesk', 'sans-serif'],
  mono: ['JetBrains Mono', 'monospace'],
},
fontSize: {
  'display-lg': ['48px', { lineHeight: '56px', fontWeight: '600', letterSpacing: '-0.02em' }],
  'headline-lg': ['32px', { lineHeight: '40px', fontWeight: '500' }],
  'headline-lg-mobile': ['28px', { lineHeight: '36px', fontWeight: '500' }],
  'title-md': ['20px', { lineHeight: '28px', fontWeight: '600' }],
  'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
  'label-sm': ['12px', { lineHeight: '16px', fontWeight: '500', letterSpacing: '0.05em' }],
},
```

### Spacing & Sizing
```typescript
spacing: {
  base: '8px',
  gutter: '24px',
  'margin-mobile': '16px',
  'margin-desktop': '40px',
},
borderRadius: { sm: '0.25rem', DEFAULT: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.5rem', full: '9999px' },
maxWidth: { 'container-max': '1280px' },
```

---

## Global CSS Classes

```css
/* Glassmorphism variants */
.glass-card {
  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.3);
  box-shadow: 0 4px 30px rgba(0,0,0,0.05);
}
.glass-card--tinted {
  border-color: rgba(119,90,25,0.1);
}
.glass-card--dark {
  background: rgba(0,0,0,0.95);
  border-color: rgba(119,90,25,0.3);
  color: #fcf9f8;
}

/* Parchment textures */
.parchment-bg {
  background: #fcf9f8;
  background-image: radial-gradient(circle at 2px 2px, rgba(0,0,0,0.02) 1px, transparent 0);
  background-size: 24px 24px;
}
.parchment-edge { clip-path: polygon(0% 0%, 100% 2%, 100% 98%, 0% 100%, 2% 50%); }

/* Crystal / Gem effects */
.crystal-gradient { background: linear-gradient(135deg, #0e3b60 0%, #775a19 100%); }
.inner-sparkle { position: relative; overflow: hidden; }
.inner-sparkle::after { /* radial-gradient sweep on hover */ }
.nexus-glow { box-shadow: 0 0 15px rgba(119,90,25,0.1); }
.inner-glow-gold { box-shadow: inset 0 0 15px rgba(254,212,136,0.4); }

/* Quibbler newspaper border */
.quibbler-border { border-top: 4px double #1c1b1b; border-bottom: 4px double #1c1b1b; }

/* Pet status bars */
.status-bar-bg { background-color: rgba(0,0,0,0.05); }

/* Borgin dark mode */
.borgin-card { background: rgba(0,0,0,0.95); border: 1px solid #775a19; }

/* Scrollbar hide */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
```

---

## Implementation Phases

### Phase 1: Project Scaffold & Config (Est. ~15 min) ✅ DONE
1. `npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir=false` ✅
2. Configure `tailwind.config.ts` with all design tokens ✅ (CSS-first via `@theme inline` in globals.css, Tailwind CSS 4)
3. Add Google Fonts (EB Garamond, Hanken Grotesk, JetBrains Mono) to `layout.tsx` ✅
4. Add Material Symbols Outlined via `next/font` or `<link>` in layout ✅
5. Write `globals.css` with all custom utility classes (glass-card, parchment, crystal, etc.) ✅
6. Create `backend/` with `requirements.txt`, FastAPI `main.py`, `database.py`, `config.py` ✅
7. Create initial Alembic migration for all models ✅ (using aiosqlite, no Alembic - direct create_all)
8. Seed database with mock data matching Stitch exports ✅

### Phase 2: UI Component Library (Est. ~30 min) ✅ DONE
1. `Button.tsx` - primary/secondary/ghost/crystal/outline variants, pill shapes ✅
2. `GlassCard.tsx` - default/tinted/dark variants with optional glow ✅
3. `Avatar.tsx` - sizes (sm/md/lg/xl), border color, status dot, image fallback ✅
4. `Badge.tsx` - active (green), count, tag, date-separator variants ✅
5. `ZerineDisplay.tsx` - amount + diamond icon, sizes sm/md/lg/hero, emoji or icon ✅
6. `ProgressBar.tsx` - fill color, glow shadow, labeled ✅
7. `SearchBar.tsx` - rounded-full or rounded-lg, icon prefix ✅
8. `Modal.tsx` - overlay, backdrop-blur, header/body/footer, close-on-backdrop ✅
9. `TabGroup.tsx` - pill buttons, active state, content switching ✅
10. `FAB.tsx` - fixed position, scale animations ✅
11. `LanguageSelector.tsx` - CSS hover dropdown, 5 languages ✅

### Phase 3: Layout Shell (Est. ~20 min) ✅ DONE
1. `AppShell.tsx` - Responsive layout: sidebar + header + main + bottom nav ✅
2. `Sidebar.tsx` - Fixed left (w-72), nav items, active state, balance display, admin button ✅
3. `TopBar.tsx` - Fixed top (h-20/h-16), brand, desktop nav, wallet/notifications, avatar, language ✅
4. `BottomNav.tsx` - Mobile only, 5 tabs, active pill state, FAB center button ✅
5. Responsive breakpoints: sidebar at `xl` (1280px), bottom nav below `md` (768px) ✅

### Phase 4: Backend API (Est. ~30 min) ✅ DONE
1. **Models**: User, Product, Article, Creature, UserCreature, Message, Post, Transaction ✅
2. **Auth**: JWT login/register, bcrypt hashing, role middleware ✅
3. **Routers**:
   - `POST /auth/login` + `POST /auth/register` ✅
   - `GET/POST/PUT/DELETE /users` ✅
   - `GET/POST/PUT/DELETE /products` (filter by shop: borgin/flourish) ✅
   - `GET/POST/PUT/DELETE /articles` ✅
   - `GET/POST/PUT/DELETE /creatures` + `POST /creatures/:id/adopt` + `POST /creatures/:id/feed` + `POST /creatures/:id/play` ✅
   - `GET/POST /messages` + `GET /messages/conversations` ✅
   - `GET/POST /posts` + `POST /posts/:id/like` ✅
   - `GET /transactions` + `POST /transactions/transfer` + `POST /transactions/deposit` + `POST /transactions/withdraw` ✅
   - `GET /dashboard` (admin: total users, products, revenue, transactions; user: personal stats) ✅

### Phase 5: Dashboard View (Est. ~20 min) ✅ DONE
- Route: `/dashboard` ✅
- **Admin KPIs**: Total users, products, articles, creatures, total Zerines in circulation, recent transactions ✅
- **User Stats**: Personal Zerines balance, messages, pets owned, recent activity ✅
- **Quick Nav**: 2x3 grid of navigation cards with icons ✅
- **Activity Feed**: Recent transactions/actions list ✅
- **Featured Creature/Product**: Highlighted card ✅ (hero section + profile snippet)

### Phase 6: Owlery (Messages) View (Est. ~25 min) ✅ DONE
- Route: `/messages` ✅
- **Desktop**: 3-pane layout (sidebar | conversation list w-80/w-96 | chat panel flex-1) ✅
- **Mobile**: Single pane with back navigation between list and chat ✅
- **Components**: ConversationList (avatar, name, last message, time, unread dot), ChatPanel (message bubbles, input, send button) ✅
- **Message Bubbles**: Incoming (surface-container-high, rounded-tl-none + parchment-message), Outgoing (primary-container, rounded-tr-none) ✅
- **Features**: Auto-resize textarea, file attachment display, timestamp, online status dots ✅
- **3rd pane**: User details sidebar on 2xl+ screens ✅

### Phase 7: Borgin & Burkes View (Est. ~25 min) ✅ DONE
- Route: `/marketplace/borgin-burkes` ✅
- **Theme**: Dark mode (inverse-surface #313030, Antique Gold accents) ✅
- **Product Grid**: 1/2/3 responsive columns, dark cards with gold borders ✅
- **Cart System**: Slide-in sidebar, add/remove items, running total ✅
- **Purchase Flow**: Cart -> Confirm -> Receipt ticket modal (parchment-edge, punch holes, dashed separator) ✅
- **Header**: Hero section "Boveda de Artefactos Oscuros", balance display, cart button with count badge ✅
- **Hover effects**: translateY lift, gold shadow, "Maldito" badge ✅

### Phase 8: Treasury View (Est. ~20 min) ✅ DONE
- Route: `/treasury` ✅
- **Crystal Hero**: Large balance display with crystal-gradient background ✅
- **Tab System**: Deposits / Withdrawals / Transfers / History ✅
- **Deposit/Withdraw Form**: Amount input with Zerine icon, submit button ✅
- **Transfer Form**: Search recipient, amount, confirm ✅
- **Transaction List**: Debit (red), credit (green), status badges, timestamps ✅
- **Stats**: Monthly activity chart area ✅ (shield security badge)

### Phase 9: El Quisquilloso (News) View (Est. ~25 min) ✅ DONE
- Route: `/news` ✅
- **Desktop Masthead**: Giant newspaper title, double-border, EST. 1990, price (single flex row) ✅
- **Desktop Layout**: 12-col grid (8 featured + 4 sidebar announcements) ✅
- **Featured Article**: Image, badge, title, excerpt, author, read-more with arrow animation ✅
- **Sidebar**: Classified announcements panel (secondary-fixed/20 bg, left border), conspiracy ad ✅
- **Forum Section**: Thread list with vote counters, avatar stacks, filter buttons ✅
- **Mobile**: Single column, bento headline cards, comments/letters section ✅
- **Effects**: Sparkle on heading hover, parchment parallax scroll, scroll-reveal animations ✅

### Phase 10: Flourish & Blotts (Bookstore) View (Est. ~20 min) ✅ DONE
- Route: `/marketplace/flourish-blotts` ✅
- **Hero Section**: Lilac-tinted banner, two CTA buttons ✅
- **Catalog Grid**: 1/2/3 responsive columns, glass cards with lilac glow ✅
- **Book Cards**: Image with badge overlay, title, author, price in Zerines, add-to-cart button ✅
- **Recommendations**: Horizontal scroll row, snap-x, small thumbnails ✅
- **Mobile**: Search bar + filter chips, horizontal book rows, bento featured section ✅
- **Cart**: "Mi Caldero" sidebar with success modal ✅

### Phase 11: Pet Sanctuary View (Est. ~20 min) ✅ DONE
- Route: `/pets` ✅
- **Desktop**: Shop section (3 creature cards), My Pets inventory (3 cards with Feed/Play), Stats bento ✅
- **Creature Cards**: Image, rarity badge, name, description, price, adopt button with sparkle ✅
- **Pet Cards**: Avatar, name, level, feeding/fun progress bars (green/blue), Feed/Play buttons ✅
- **Empty Slot**: Dashed border, add icon, hover scale ✅
- **Mobile**: Stats parchment card, adoption grid with stat bars inline ✅
- **Hero**: "La Menajeria Susurrante" banner with stats ✅

### Phase 12: Profile View (Est. ~20 min) ✅ DONE
- Route: `/profile/[id]` ✅
- **Header**: Gradient banner (primary->secondary), overlapping avatar, name, house, badges, bio ✅
- **Left Column**: Stats card (3 numbers), Details (location, wand, member since), Friends grid (3x2), Zerines progress ✅
- **Right Column**: Post creation box, Post feed with like/comment/recast actions ✅
- **Activity Summary**: Publicaciones, Amigos, Zerines, Se unio ✅
- **Follow/Message**: Action buttons on other profiles ✅

### Phase 13: Admin CRUD Views (Est. ~25 min) ✅ DONE
- Route: `/admin/*` ✅
- **Layout**: Admin sub-layout with management sidebar ✅ (inline role check per page)
- **CrudTable.tsx**: Reusable data table with sort, search, pagination ✅ (inline in each page)
- **CrudForm.tsx**: Reusable create/edit form with validation ✅ (inline in each page)
- **Sections**: Users ✅, Products ✅ (borgin + flourish), Articles ✅, Creatures ✅, Transactions ✅
- **Admin KPIs**: Dashboard-style overview at `/admin` ✅ (users page shows counts)
- **Access**: Role-gated, redirect non-admins ✅

### Phase 14: Integration & Polish (Est. ~15 min) ✅ DONE
1. Wire all frontend views to backend API ✅
2. Implement Zustand stores (auth, cart, theme) ✅ (auth + cart done, theme not needed)
3. Add loading states, error boundaries, empty states ✅
4. Responsive testing and fixes ✅
5. Add missing micro-interactions (hover effects, scroll reveals) ✅
6. Final lint + typecheck pass ✅

---

## Database Schema

### User
```sql
id: UUID (PK)
name: VARCHAR(100)
email: VARCHAR(255) UNIQUE
password_hash: VARCHAR(255)
role: ENUM('admin', 'user') DEFAULT 'user'
zerines: INTEGER DEFAULT 0
avatar_url: VARCHAR(500)
house: VARCHAR(50)
bio: TEXT
created_at: TIMESTAMP
```

### Product
```sql
id: UUID (PK)
name: VARCHAR(200)
description: TEXT
price: INTEGER  -- Zerines
category: VARCHAR(100)
shop: ENUM('borgin', 'flourish')
image_url: VARCHAR(500)
stock: INTEGER DEFAULT 0
created_at: TIMESTAMP
```

### Article
```sql
id: UUID (PK)
title: VARCHAR(300)
body: TEXT
author_id: UUID (FK -> User)
category: VARCHAR(100)
image_url: VARCHAR(500)
featured: BOOLEAN DEFAULT false
created_at: TIMESTAMP
```

### Creature
```sql
id: UUID (PK)
name: VARCHAR(100)
description: TEXT
rarity: ENUM('common', 'uncommon', 'rare', 'legendary', 'ethereal')
price: INTEGER  -- Zerines to adopt
image_url: VARCHAR(500)
created_at: TIMESTAMP
```

### UserCreature
```sql
id: UUID (PK)
user_id: UUID (FK -> User)
creature_id: UUID (FK -> Creature)
level: INTEGER DEFAULT 1
hunger: INTEGER DEFAULT 50  -- 0-100
happiness: INTEGER DEFAULT 50  -- 0-100
adopted_at: TIMESTAMP
```

### Message
```sql
id: UUID (PK)
sender_id: UUID (FK -> User)
receiver_id: UUID (FK -> User)
body: TEXT
read: BOOLEAN DEFAULT false
created_at: TIMESTAMP
```

### Post
```sql
id: UUID (PK)
author_id: UUID (FK -> User)
body: TEXT
image_url: VARCHAR(500)
created_at: TIMESTAMP
```

### PostLike
```sql
post_id: UUID (FK -> Post)
user_id: UUID (FK -> User)
created_at: TIMESTAMP
PRIMARY KEY (post_id, user_id)
```

### Transaction
```sql
id: UUID (PK)
sender_id: UUID (FK -> User, nullable for deposits)
receiver_id: UUID (FK -> User, nullable for withdrawals)
amount: INTEGER
type: ENUM('deposit', 'withdrawal', 'transfer', 'purchase')
description: VARCHAR(500)
status: ENUM('pending', 'confirmed', 'completed')
created_at: TIMESTAMP
```

---

## API Endpoints Summary

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/auth/register` | No | - | Register new user |
| POST | `/auth/login` | No | - | Login, returns JWT |
| GET | `/auth/me` | Yes | Any | Current user profile |
| GET | `/users` | Yes | admin | List all users |
| GET | `/users/:id` | Yes | Any | User profile |
| PUT | `/users/:id` | Yes | admin/self | Update user |
| DELETE | `/users/:id` | Yes | admin | Delete user |
| GET | `/products?shop=` | Yes | Any | List products (filter by shop) |
| POST | `/products` | Yes | admin | Create product |
| PUT | `/products/:id` | Yes | admin | Update product |
| DELETE | `/products/:id` | Yes | admin | Delete product |
| GET | `/articles` | Yes | Any | List articles |
| POST | `/articles` | Yes | admin | Create article |
| PUT | `/articles/:id` | Yes | admin | Update article |
| DELETE | `/articles/:id` | Yes | admin | Delete article |
| GET | `/creatures` | Yes | Any | List creatures |
| POST | `/creatures` | Yes | admin | Create creature |
| POST | `/creatures/:id/adopt` | Yes | user | Adopt creature (deducts Zerines) |
| POST | `/creatures/:id/feed` | Yes | user | Feed creature (+hunger, -10 Zerines) |
| POST | `/creatures/:id/play` | Yes | user | Play with creature (+happiness) |
| GET | `/creatures/my` | Yes | user | User's adopted creatures |
| GET | `/messages/conversations` | Yes | Any | List conversations |
| GET | `/messages/:userId` | Yes | Any | Messages with specific user |
| POST | `/messages` | Yes | Any | Send message |
| GET | `/posts` | Yes | Any | List posts (feed) |
| POST | `/posts` | Yes | Any | Create post |
| POST | `/posts/:id/like` | Yes | Any | Toggle like on post |
| GET | `/transactions` | Yes | Any | Transaction history |
| POST | `/transactions/deposit` | Yes | Any | Deposit Zerines |
| POST | `/transactions/withdraw` | Yes | Any | Withdraw Zerines |
| POST | `/transactions/transfer` | Yes | Any | Transfer to another user |
| GET | `/dashboard` | Yes | Any | Dashboard data (admin: global, user: personal) |

---

## Mock Data (Seed)

### Users (5)
| Name | Email | Role | Zerines | House |
|------|-------|------|---------|-------|
| Albus Dumbledore | admin@nexus.com | admin | 50,000 | Gryffindor |
| Hermione Granger | hermione@nexus.com | user | 14,205 | Gryffindor |
| Luna Lovegood | luna@nexus.com | user | 8,750 | Ravenclaw |
| Cedric Diggory | cedric@nexus.com | user | 12,300 | Hufflepuff |
| Harry Potter | harry@nexus.com | user | 22,100 | Gryffindor |

### Products - Borgin & Burkes (5)
| Name | Price | Category |
|------|-------|----------|
| Espejo de Oesed | 850 | Reliquia Rara |
| Grito de la Banshee | 1,200 | Objeto Oscuro |
| Caliz de Helga Hufflepuff | 2,500 | Reliquia Historica |
| Sombrero Seleccionador (usado) | 3,000 | Artefacto |
| Pluma Bicorne de Newt | 450 | Curiosidad |

### Products - Flourish & Blotts (5)
| Name | Price | Category |
|------|-------|----------|
| Libro Estandar de Hechizos | 250 | Grado 1 |
| Una Historia de la Magia | 420 | Historia |
| Mil Hierbas Magicas | 180 | Botanica |
| Bases de Defensa Contra las Artes Oscuras | 95 | D.C.A.O. |
| Animales Fantasticos | 310 | Zoologia |

### Creatures (5)
| Name | Rarity | Price | Description |
|------|--------|-------|-------------|
| Fenix Llamarada Solar | rare | 450 | Calienta hogares con su zumbido melodico |
| Escarbato Obsidiana | uncommon | 320 | Encuentra Zerines perdidos |
| Buho de Escarcha Lunar | ethereal | 600 | Entrega mensajes en la medianoche |
| Gato de Niebla | common | 200 | Companero silencioso y leal |
| Hipogrifo Albino | legendary | 5,200 | Vuelo majestuoso entre nubes |

### Articles (5)
| Title | Category | Featured |
|-------|----------|----------|
| Snorkack de Cuernos Arrugados avistado en Suecia | Zoologia Mágica | true |
| Gringotts anuncia nueva tasa de Zerines | Economia | false |
| Tormentas de Escarcha en el Callejon Diagon | Callejones | false |
| El Ministerio confirma: los Acromantulas no son domesticables | Ministerio | false |
| Guia definitiva para el examen de transformaciones | Hogwarts | false |

---

## Execution Order

1. **Phase 1** -> Scaffold (Next.js + FastAPI + DB + seed)
2. **Phase 2** -> UI components library
3. **Phase 3** -> Layout shell (responsive shell)
4. **Phase 4** -> Backend API + auth
5. **Phase 5** -> Dashboard
6. **Phase 6** -> Owlery (Messages)
7. **Phase 7** -> Borgin & Burkes
8. **Phase 8** -> Treasury
9. **Phase 9** -> El Quisquilloso
10. **Phase 10** -> Flourish & Blotts
11. **Phase 11** -> Pet Sanctuary
12. **Phase 12** -> Profile
13. **Phase 13** -> Admin CRUD
14. **Phase 14** -> Integration, polish, responsive testing
