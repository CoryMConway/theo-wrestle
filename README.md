# TheoWrestle

**Wrestle with theology. Let AI help you see the bigger picture.**

TheoWrestle is a journaling app for anyone exploring theology — whether you're working through tough questions, processing sermons, studying scripture, or just thinking out loud about faith. Write freely, and AI will summarize your entries, extract themes, and analyze how your thinking evolves over time.

<img width="1693" height="1026" alt="Screenshot 2026-04-03 at 3 42 24 PM" src="https://github.com/user-attachments/assets/3d9cc851-bc4b-40d9-a359-88516238469e" />

<img width="1693" height="1026" alt="Screenshot 2026-04-03 at 6 43 53 PM" src="https://github.com/user-attachments/assets/28d8cd60-91a7-49db-97eb-c52105112149" />

<img width="1693" height="1026" alt="Screenshot 2026-04-03 at 6 42 38 PM" src="https://github.com/user-attachments/assets/5f00fb65-86f7-4c57-919d-b1cd7b198953" />


## Try It

TheoWrestle is hosted for free at **[coryconway-theowrestle.hf.space](https://coryconway-theowrestle.hf.space/)**. Create an account and start journaling — no setup required.

## Host your own instance (free on Hugging Face)

If you’re running a community and want your own free deployment:

1. Fork this repo on GitHub.
2. Go to https://huggingface.co/new-space, choose your SDK, then select **GitHub repository** and paste your fork URL.
3. Deploy — it will build the same app from your fork.

### Keep your fork updated

- In your GitHub fork, click **Sync fork** whenever new updates land on `main`.
- Your Hugging Face Space will automatically rebuild after your next push.

## Features

- **Brain-dump journaling** — Write freely without structure. Entries are your raw theological wrestling.
- **AI summaries** — Each entry is automatically summarized so you can revisit ideas at a glance.
- **Theme extraction** — AI identifies theological themes and tags across your entries.
- **Progression analysis** — Get an AI-generated overview of how your theological thinking has grown and shifted over time.
- **Timeline view** — Browse your entries chronologically to see your journey.
- **Username/password auth** — Simple account creation with secure bcrypt-hashed passwords.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, Tailwind CSS v4, Radix UI, Wouter |
| Backend | Express, tRPC v11, Drizzle ORM |
| Database | SQLite (via better-sqlite3) |
| AI | LLM integration via HuggingFace Inference API |
| Auth | JWT cookies, bcrypt |
| Hosting | Docker on HuggingFace Spaces |

## Project Structure

```
server/
├── index.ts             # Express server, tRPC middleware, static serving
├── routers.ts           # tRPC router definitions (auth, journal, progression)
├── context.ts           # tRPC context (user from JWT cookie)
├── env.ts               # Environment variable config
├── db/
│   ├── db.ts            # SQLite connection & query helpers
│   └── schema.ts        # Drizzle ORM schema (users, entries, summaries)
└── lib/
    ├── llm.ts           # LLM client for summaries & analysis
    └── cookies.ts       # Cookie helpers

src/
├── App.tsx              # Client routing
├── main.tsx             # React entrypoint
├── pages/               # AuthPage, Home, EntryDetail, Timeline, Progression
├── layouts/             # DashboardLayout with sidebar
├── components/ui/       # Reusable Radix-based UI components
├── hooks/               # useAuth, useMobile
└── lib/                 # tRPC client, utils

shared/
└── const.ts             # Constants shared between client & server
```

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Clone the repo
git clone https://github.com/coryconway/TheoWrestle.git
cd TheoWrestle

# Install dependencies
npm install

# Start dev server (client + server with hot reload)
npm run dev
```

The client runs at `http://localhost:5173` and the API server at `http://localhost:3000`.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for signing auth cookies | `dev-secret-change-me` |
| `HF_TOKEN` | Hugging Face Access Token for LLM API | — |
| `HF_MODEL` | Hugging Face Model ID for LLM API | `meta-llama/Meta-Llama-3-8B-Instruct` |
| `SQLITE_PATH` | Path to SQLite database file | `./theowrestle.db` (dev) / `/data/theowrestle.db` (prod) |
| `PORT` | Server port | `3000` |

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start client + server in dev mode |
| `npm run build` | Build client (Vite) and compile server (TypeScript) |
| `npm start` | Run the production server |
| `npm test` | Run tests with Vitest |

## Docker

```bash
docker build -t theowrestle .
docker run -p 7860:7860 \
  -e JWT_SECRET=your-secret \
  -e HF_TOKEN=your-hf-token \
  -e HF_MODEL=meta-llama/Meta-Llama-3-8B-Instruct \
  -v theowrestle-data:/data \
  theowrestle
```

The `/data` volume persists the SQLite database across container restarts.

## License

MIT
