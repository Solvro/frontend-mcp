# Graph Report - ml-mcp-frontend  (2026-09-20)

## Corpus Check
- Corpus is ~26,578 words - fits in a single context window. You may not need a graph.

## Summary
- 310 nodes · 526 edges · 15 communities (13 shown, 2 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.86)
- Token cost: 207,584 input · 0 output

## Community Hubs (Navigation)
- Composer, Sidebar & Icon Set
- BFF Proxy Route Handlers
- Design Doctrine & Integration Plan
- API Client, Errors & History Types
- Landing Page, Quota Lock & Auth State
- Build Tooling & Dependencies
- Window Scenography & Auth Overlay
- TypeScript Compiler Config
- Chat Thread & Mock Data
- Root Layout, Fonts & Theme Tokens
- PWR Brand Identity
- Solvro Brand Identity
- Anti-AI-Slop Design Rules
- Accessibility & Motion

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `react` - 14 edges
3. `ApiError` - 9 edges
4. `POST()` - 7 edges
5. `Landing()` - 7 edges
6. `AuthOverlay()` - 7 edges
7. `toApiError()` - 7 edges
8. `serviceUrl()` - 7 edges
9. `forwardWithRefresh()` - 7 edges
10. `next` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Antywymagania — brak "AI slop"` --semantically_similar_to--> `Antywzorce zakazane w designie`  [INFERRED] [semantically similar]
  CLAUDE.md → DESIGN.md
- `Blokada limitu pytań (quotaLock, pigułka "Okienko zamknięte")` --semantically_similar_to--> `ApiError / toApiError — RFC 7807 na polskie komunikaty`  [INFERRED] [semantically similar]
  DESIGN.md → docs/superpowers/plans/2026-09-18-frontend-backend-integration.md
- `README z create-next-app (nieaktualny boilerplate)` --conceptually_related_to--> `Typografia: Inter / Fraunces / JetBrains Mono`  [AMBIGUOUS]
  README.md → DESIGN.md
- `Panel konta (UserMenu) w sidebarze` --implements--> `useAuth / AuthProvider — kontekst logowania`  [INFERRED]
  DESIGN.md → docs/superpowers/plans/2026-09-18-frontend-backend-integration.md
- `Landing()` --calls--> `useChat()`  [EXTRACTED]
  components/Landing.tsx → lib/useChat.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Ścieżka żądania przeglądarka → BFF → backend** — docs_superpowers_plans_2026_09_18_frontend_backend_integration_api_client, docs_superpowers_plans_2026_09_18_frontend_backend_integration_path_allowlist, docs_superpowers_plans_2026_09_18_frontend_backend_integration_forward_with_refresh, docs_superpowers_plans_2026_09_18_frontend_backend_integration_token_cookies, docs_superpowers_plans_2026_09_18_frontend_backend_integration_chat_service_contract [EXTRACTED 1.00]
- **Przepływ logowania (dialog → kontekst → ciasteczka → historia)** — docs_superpowers_plans_2026_09_18_frontend_backend_integration_auth_dialog, docs_superpowers_plans_2026_09_18_frontend_backend_integration_use_auth, docs_superpowers_plans_2026_09_18_frontend_backend_integration_token_cookies, docs_superpowers_plans_2026_09_18_frontend_backend_integration_use_conversations, design_panel_konta, docs_superpowers_plans_2026_09_18_frontend_backend_integration_email_link_pages [EXTRACTED 1.00]
- **Scenografia okienka jako jeden system wizualny** — design_okienko_dziekanatu, design_trzy_warstwy_glebi, design_tokeny_kolorow, design_deterministyczny_lcg, design_view_transitions [INFERRED 0.85]
- **Solvro brand identity system (mark, monogram, palette, style)** — public_brand_38877128_solvro_logo, public_brand_38877128_chevron_s_monogram, public_brand_38877128_solvro_palette, public_brand_38877128_flat_vector_mark_style [INFERRED 0.85]
- **PWR Visual Identity: crest, wordmark and two-color palette in one stacked lockup** — public_brand_logo_pwr_eagle_crest_mark, public_brand_logo_pwr_wordmark, public_brand_logo_pwr_palette, public_brand_logo_pwr_stacked_lockup [INFERRED 0.85]

## Communities (15 total, 2 thin omitted)

### Community 0 - "Composer, Sidebar & Icon Set"
Cohesion: 0.08
Nodes (36): Composer(), ComposerProps, components_composer_module, ArrowUpIcon(), ChevronUpDownIcon(), ClockIcon(), FileIcon(), GraphMark() (+28 more)

### Community 1 - "BFF Proxy Route Handlers"
Cohesion: 0.09
Nodes (34): Context, GET(), notFound(), PASS_THROUGH, POST(), postJson(), Context, DELETE (+26 more)

### Community 2 - "Design Doctrine & Integration Plan"
Cohesion: 0.06
Nodes (41): Next.js Agent Rules (breaking changes), Integracja z backend-mcp (streszczenie w CLAUDE.md), Figma jako źródło prawdy dla wyglądu, Zasada: żadnych commitów bez prośby, ml-mcp-frontend (Graf Wiedzy), Stack bez Tailwinda (CSS Modules + zmienne CSS), Wątek rozmowy (ChatThread) — okienko jako tło, Deterministyczny LCG dla układu segregatorów (+33 more)

### Community 3 - "API Client, Errors & History Types"
Cohesion: 0.11
Nodes (26): RFC-7807, api, post(), request(), ApiError, codeFromDetail(), messageFor(), MESSAGES (+18 more)

### Community 4 - "Landing Page, Quota Lock & Auth State"
Cohesion: 0.11
Nodes (27): HeartIcon(), IMAGE_EXTENSIONS, Landing(), components_landing_module, toAttachment(), components_quotanotice_module, QuotaNotice(), QuotaNoticeProps (+19 more)

### Community 5 - "Build Tooling & Dependencies"
Cohesion: 0.07
Nodes (29): eslintConfig, dependencies, next, react, react-dom, devDependencies, eslint, eslint-config-next (+21 more)

### Community 6 - "Window Scenography & Auth Overlay"
Cohesion: 0.12
Nodes (18): AuthOverlay(), AuthOverlayProps, clipAt(), COPY, isVisible(), Mode, components_auth_authoverlay_module, placeGhost() (+10 more)

### Community 7 - "TypeScript Compiler Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 8 - "Chat Thread & Mock Data"
Cohesion: 0.18
Nodes (10): ChatThread(), ChatThreadProps, components_chatthread_module, CONVERSATION_GROUPS, TODO: podmienić na fetch z API historii (MCP + warstwa ML)., SUGGESTIONS, Attachment, ChatMessage (+2 more)

### Community 9 - "Root Layout, Fonts & Theme Tokens"
Cohesion: 0.25
Nodes (6): app_globals, fraunces, inter, jetbrainsMono, metadata, viewport

### Community 10 - "PWR Brand Identity"
Cohesion: 0.53
Nodes (6): Politechnika Wrocławska Logo (logo_pwr.png), Silesian Eagle Crest Mark, Wrocław University of Science and Technology (PWR), PWR Brand Palette (deep red #A5140F / cream #F5CFA0), Stacked Mark-Over-Wordmark Lockup, Wordmark "Politechnika Wrocławska"

### Community 11 - "Solvro Brand Identity"
Cohesion: 0.60
Nodes (5): Chevron-and-S Monogram, Flat Vector Mark Style (no gradients, no photo texture), Solvro Logo (brand mark asset), Solvro (PWR student science club), Solvro Palette (navy #1B2E4F + light blue #7BA7E8)

### Community 12 - "Anti-AI-Slop Design Rules"
Cohesion: 0.67
Nodes (3): Antywymagania — brak "AI slop", Antywzorce zakazane w designie, Własny zestaw ikon SVG (Icons.tsx)

## Ambiguous Edges - Review These
- `Typografia: Inter / Fraunces / JetBrains Mono` → `README z create-next-app (nieaktualny boilerplate)`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **93 isolated node(s):** `Context`, `PASS_THROUGH`, `Context`, `GET`, `POST` (+88 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 122 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Typografia: Inter / Fraunces / JetBrains Mono` and `README z create-next-app (nieaktualny boilerplate)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `next` connect `BFF Proxy Route Handlers` to `Composer, Sidebar & Icon Set`, `Root Layout, Fonts & Theme Tokens`, `Build Tooling & Dependencies`?**
  _High betweenness centrality (0.160) - this node is a cross-community bridge._
- **Why does `react` connect `Composer, Sidebar & Icon Set` to `API Client, Errors & History Types`, `Landing Page, Quota Lock & Auth State`, `Build Tooling & Dependencies`, `Window Scenography & Auth Overlay`, `Chat Thread & Mock Data`?**
  _High betweenness centrality (0.159) - this node is a cross-community bridge._
- **Why does `vitest` connect `API Client, Errors & History Types` to `BFF Proxy Route Handlers`, `Build Tooling & Dependencies`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **What connects `Context`, `PASS_THROUGH`, `Context` to the rest of the system?**
  _93 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Composer, Sidebar & Icon Set` be split into smaller, more focused modules?**
  _Cohesion score 0.08084163898117387 - nodes in this community are weakly interconnected._
- **Should `BFF Proxy Route Handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.09291521486643438 - nodes in this community are weakly interconnected._