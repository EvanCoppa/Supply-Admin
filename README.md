# Supply Admin

SvelteKit + Tailwind CSS v4 + Supabase starter.

## Stack

- [SvelteKit 2](https://kit.svelte.dev) with Svelte 5 runes
- [Tailwind CSS v4](https://tailwindcss.com) via `@tailwindcss/vite`
- [Supabase](https://supabase.com) via `@supabase/supabase-js` and `@supabase/ssr` for cookie-based session handling

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase project values
npm run dev
```

### Environment variables

| Name | Description |
| --- | --- |
| `PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon (publishable) key |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run check` | Type-check with `svelte-check` |

## Project layout

```
src/
  app.css                 # Tailwind entry (@import 'tailwindcss')
  app.d.ts                # App type augmentations (Locals, PageData)
  app.html                # HTML shell
  hooks.server.ts         # Supabase SSR client + auth guard
  routes/
    +layout.server.ts     # Exposes session, user, cookies to the client load
    +layout.ts            # Creates the browser/server Supabase client
    +layout.svelte        # Subscribes to auth state changes
    +page.svelte          # Landing page
```

Any route under `/private/*` is gated in `hooks.server.ts` and redirects to `/` when unauthenticated.
