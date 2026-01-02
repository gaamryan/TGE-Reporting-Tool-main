# TGE Reporting Tool

An AI-native data platform for real estate lead attribution and intelligence. Built to ingest leads from multiple sources, match them against CRM data (Follow Up Boss), and provide conversational analytics.

## Live Demo

**Production URL**: https://tge-reporting-tool.vercel.app/

## Current Status

### What's Working

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard with metrics | ✅ Working | Fetches from Supabase, shows sample data if empty |
| AI Chat Assistant | ✅ Working | CopilotKit + OpenAI (gpt-5.1) |
| Widget Generation via Chat | ✅ Working | "Create a chart of leads by source" |
| Widget Drag & Drop | ✅ Working | Reorder widgets on dashboard |
| Lead Table with Filters | ✅ Working | Search, filter by status/source |
| Match Review Queue | ✅ Working | Approve/reject (client-side only) |
| Insights Display | ✅ Working | Shows AI insights (sample data) |
| Dark/Light Mode | ✅ Working | Theme switching |
| Mobile Responsive | ✅ Working | Sidebar collapses on mobile |

### What's Missing (MVP Gaps)

| Feature | Priority | Notes |
|---------|----------|-------|
| Authentication (Login/Signup) | 🔴 Critical | Users bypass auth currently |
| CSV Upload UI | 🔴 Critical | No way to import leads |
| Data Persistence | 🔴 Critical | Match approvals don't save to DB |
| Follow Up Boss Integration | 🟡 High | API connection not implemented |
| Settings Save | 🟡 High | Changes don't persist |
| Export to CSV | 🟡 High | Button exists, not functional |
| Insight Generation | 🟡 High | "Generate New" button not working |
| Team Management | 🟢 Medium | Invite/manage team members |
| Email Ingest Setup | 🟢 Medium | Configure ingest addresses |
| Real-time Updates | 🟢 Medium | WebSocket/polling not active |

### Button Status by Page

| Page | Button | Works? |
|------|--------|--------|
| Dashboard | Refresh | ✅ Yes |
| Dashboard | AI Assistant Toggle | ✅ Yes |
| Leads | Sync | ❌ No |
| Leads | Export | ❌ No |
| Matches | Approve/Reject | ⚠️ Partial (client-side) |
| Insights | Mark All Read | ❌ No |
| Insights | Generate New | ❌ No |
| Insights | Take Action | ❌ No |
| Settings | Save Changes | ❌ No |
| Settings | Invite Member | ❌ No |
| Settings | Manage Sources | ❌ No |
| Chat | Save to Dashboard | ❌ No (shows alert) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INGESTION LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Email Ingest │  │  API Upload  │  │  FUB Polling │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         └─────────────────┼─────────────────┘                       │
│                           ▼                                          │
│                   ┌───────────────┐                                  │
│                   │  Raw Staging  │                                  │
│                   └───────┬───────┘                                  │
└───────────────────────────┼──────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      TRANSFORMATION LAYER                            │
│         ┌─────────────────┼─────────────────┐                       │
│         ▼                 ▼                 ▼                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │  Normalize  │  │    Match    │  │   Embed     │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│         └─────────────────┼─────────────────┘                       │
│                           ▼                                          │
│                   ┌───────────────┐                                  │
│                   │ Canonical DB  │ ←── pgvector enabled            │
│                   └───────────────┘                                  │
└───────────────────────────┼──────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      INTELLIGENCE LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Chat w/ Data │  │  Reports     │  │  Alerts      │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Backend
- **Database**: Supabase (PostgreSQL + pgvector)
- **Edge Functions**: 8 deployed (Deno/TypeScript)
- **AI**: OpenAI via CopilotKit
- **Hosting**: Vercel (frontend) + Supabase (backend)

### Frontend
- **Framework**: Next.js 15.3.6 (App Router)
- **AI Chat**: CopilotKit
- **UI Components**: shadcn/ui + Radix UI
- **Charts**: Recharts
- **Drag & Drop**: dnd-kit
- **Styling**: Tailwind CSS

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase CLI
- Supabase project (already configured)

### Local Development

```bash
# Clone
git clone https://github.com/onwardfaster/TGE-Reporting-Tool.git
cd TGE-Reporting-Tool

# Install dependencies
cd web
npm install

# Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://dkkhrokmtoecoxyxiohj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=your-openai-key
EOF

# Run dev server
npm run dev
```

Open http://localhost:3000

### Deploy to Vercel

1. Push to GitHub
2. Import to Vercel
3. Set root directory to `web`
4. Add environment variables
5. Deploy

## Project Structure

```
TGE-Reporting-Tool/
├── supabase/
│   ├── config.toml
│   ├── migrations/          # 11 migration files
│   └── functions/           # 8 Edge Functions
│       ├── ai-insights/
│       ├── ai-query/
│       ├── csv-parser/
│       ├── email-ingest/
│       ├── embedding-worker/
│       ├── fub-sync/
│       ├── lead-matcher/
│       └── lead-transformer/
└── web/                     # Next.js Frontend
    ├── app/
    │   ├── (dashboard)/     # Main app pages
    │   └── api/             # API routes
    ├── components/
    │   ├── ui/              # shadcn/ui
    │   ├── chat/            # AI chat
    │   ├── widgets/         # Dashboard widgets
    │   └── dashboard/       # Dashboard grid
    ├── hooks/               # Custom React hooks
    ├── lib/                 # Utilities
    └── types/               # TypeScript types
```

## Database Schema

### Core Tables
- `organizations` - Real estate brokerages
- `teams` - Groups within organizations
- `agents` - Individual agents
- `lead_sources` - Configured sources (Zillow, etc.)

### Lead Pipeline
- `raw_ingestions` - Batch imports
- `raw_lead_rows` - Pre-normalized rows
- `source_leads` - Normalized leads with embeddings
- `fub_leads` - Synced FUB data

### Matching
- `lead_matches` - Confirmed matches
- `match_candidates` - Pending review

### AI
- `ai_conversations` - Chat sessions
- `ai_messages` - Messages with context
- `ai_insights` - Generated insights

## Edge Functions

| Function | Description | Status |
|----------|-------------|--------|
| `email-ingest` | Receive emails with CSV | Deployed |
| `csv-parser` | Parse CSV files | Deployed |
| `lead-transformer` | Normalize leads | Deployed |
| `lead-matcher` | Match algorithm | Deployed |
| `fub-sync` | FUB API polling | Deployed |
| `embedding-worker` | Generate embeddings | Deployed |
| `ai-query` | Chat with data | Deployed |
| `ai-insights` | Generate insights | Deployed |

## Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-...

# Optional (for full functionality)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FUB_API_KEY=your-fub-api-key
```

## Roadmap

### Phase 1: Data Ingestion (Next)
- [ ] CSV upload UI
- [ ] Email ingest configuration
- [ ] Manual lead entry form

### Phase 2: Authentication
- [ ] Login/signup pages
- [ ] Protected routes
- [ ] User session management

### Phase 3: Persistence
- [ ] Save match decisions to DB
- [ ] Persist settings changes
- [ ] Widget configuration storage

### Phase 4: Integrations
- [ ] Follow Up Boss API connection
- [ ] Real-time FUB sync
- [ ] Webhook handlers

### Phase 5: Polish
- [ ] Export functionality
- [ ] Email reports
- [ ] Team invitations
- [ ] Notification system

## License

Proprietary - All rights reserved.
