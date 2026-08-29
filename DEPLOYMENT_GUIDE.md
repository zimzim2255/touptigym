# 🚀 TouptiGym — Deployment & Branch Guide

## 📌 Overview

This project has **2 separate databases** using the **same codebase**:

| Branch | Database | Supabase Project | Vercel Environment |
|--------|----------|-----------------|-------------------|
| `main` | Non-Casa (original) | `lpjdpcguplkpdfgxomps` | Production |
| `casa` | Casa | `atvdorphwnpzhobvfmtz` | Preview / Separate Project |

---

## 🔀 Branch Workflow

### When you make a code change (e.g. new feature, bug fix):

```
1. Create a feature branch from the branch you're working on:
   git checkout main          (or: git checkout casa)
   git checkout -b feature/my-change

2. Make your code changes...

3. Commit & push:
   git add .
   git commit -m "feat: description of change"
   git push -u origin feature/my-change

4. Create a Pull Request (PR) on GitHub:
   - If working on main → PR into main
   - If working on casa → PR into casa
```

### ⚠️ IMPORTANT — Syncing changes between branches:

Since `main` and `casa` share the same code, **every code change must be applied to BOTH branches**.

**Option 1 — Merge (recommended for most changes):**
```bash
# After merging a PR into main:
git checkout casa
git merge main
git push origin casa
```

**Option 2 — Cherry-pick (for specific commits only):**
```bash
# Get the commit hash from main:
git log --oneline main

# Apply it to casa:
git checkout casa
git cherry-pick <commit-hash>
git push origin casa
```

---

## 🔐 Environment Variables (`.env`)

The `.env` files are **NOT tracked by git** (gitignored). Each environment must have its own credentials.

### Local Development:

**For Casa work:**
```env
# .env
VITE_SUPABASE_URL=https://atvdorphwnpzhobvfmtz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_A6MqQPu7dnrtr04JFtHGBg_rRw8e_Nb
VITE_CLOUDINARY_CLOUD_NAME=td3fzirz
```

**For Non-Casa work:**
```env
# .env
VITE_SUPABASE_URL=https://lpjdpcguplkpdfgxomps.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_51kPQ-pyABP2B8gK4aAkrQ_p3BPRnxJ
VITE_CLOUDINARY_CLOUD_NAME=td3fzirz
```

---

## ☁️ Cloudinary (photo uploads)

The app uploads child/trainer photos through the **`upload` edge function**, which performs a **signed** upload to the real Cloudinary account (`td3fzirz`).

> ⚠️ The cloud name `toutigym` in the old `.env` files was **not a real Cloudinary account** — that is what caused `Unknown API key` when adding a child photo. The `toutigym_preset` needed for unsigned uploads does **not** exist on `td3fzirz`, so uploads must be **signed** server-side (never with the secret in the browser).

**Frontend `.env` / Vercel build env (both branches):**
```env
VITE_CLOUDINARY_CLOUD_NAME=td3fzirz
```

**Edge function secrets (set once per Supabase project, after deploying `upload`):**
```bash
npx supabase functions deploy upload --project-ref atvdorphwnpzhobvfmtz
npx supabase secrets set --project-ref atvdorphwnpzhobvfmtz \
  CLOUDINARY_CLOUD_NAME=td3fzirz \
  CLOUDINARY_API_KEY=486274344365529 \
  CLOUDINARY_API_SECRET=3LaqXDn-69bmwidN0OJFPan0_tM
```

> ⚠️ Never expose `CLOUDINARY_API_SECRET` in the frontend `.env` — it must stay server-side only.

---

## 🗄️ Supabase Edge Functions Deployment

### Deploy to Casa:
```bash
npx supabase functions deploy <function-name> --project-ref atvdorphwnpzhobvfmtz
```

### Deploy to Non-Casa:
```bash
npx supabase functions deploy <function-name> --project-ref lpjdpcguplkpdfgxomps
```

### Deploy ALL functions at once:
```bash
# Casa:
npx supabase functions deploy attendance --project-ref atvdorphwnpzhobvfmtz
npx supabase functions deploy checks --project-ref atvdorphwnpzhobvfmtz
npx supabase functions deploy children --project-ref atvdorphwnpzhobvfmtz
npx supabase functions deploy exercises --project-ref atvdorphwnpzhobvfmtz
npx supabase functions deploy groups --project-ref atvdorphwnpzhobvfmtz
npx supabase functions deploy iclock --project-ref atvdorphwnpzhobvfmtz
npx supabase functions deploy parents --project-ref atvdorphwnpzhobvfmtz
npx supabase functions deploy payments --project-ref atvdorphwnpzhobvfmtz
npx supabase functions deploy prices --project-ref atvdorphwnpzhobvfmtz
npx supabase functions deploy requests --project-ref atvdorphwnpzhobvfmtz
npx supabase functions deploy send-birthday-emails --project-ref atvdorphwnpzhobvfmtz
npx supabase functions deploy send-welcome-email --project-ref atvdorphwnpzhobvfmtz
npx supabase functions deploy subscriptions --project-ref atvdorphwnpzhobvfmtz
npx supabase functions deploy trainers --project-ref atvdorphwnpzhobvfmtz
npx supabase functions deploy upload --project-ref atvdorphwnpzhobvfmtz
npx supabase functions deploy zkteco --project-ref atvdorphwnpzhobvfmtz
```

---

## ▲ Vercel Deployment — How it separates main from casa

### Recommended Setup: **2 Vercel Projects**

Create **2 separate Vercel projects** pointing to the same GitHub repo:

| Vercel Project | Git Branch | Environment |
|----------------|-----------|-------------|
| `touptigym` (non-casa) | `main` | Production |
| `touptigym-casa` | `casa` | Production |

### Steps in Vercel:

**Project 1 — Non-Casa (main):**
1. In Vercel: **Add New Project** → Import `touptigym` repo
2. Set **Production Branch** to `main`
3. Add Environment Variables:
   ```
   VITE_SUPABASE_URL=https://lpjdpcguplkpdfgxomps.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_51kPQ-pyABP2B8gK4aAkrQ_p3BPRnxJ
   ```
4. Deploy

**Project 2 — Casa:**
1. In Vercel: **Add New Project** → Import `touptigym` repo
2. Set **Production Branch** to `casa`
3. Add Environment Variables:
   ```
   VITE_SUPABASE_URL=https://atvdorphwnpzhobvfmtz.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_A6MqQPu7dnrtr04JFtHGBg_rRw8e_Nb
   VITE_CLOUDINARY_CLOUD_NAME=td3fzirz
   ```
4. Deploy

### How Vercel auto-deploys:

- **Push to `main`** → Vercel auto-deploys to **touptigym** (non-Casa) production
- **Push to `casa`** → Vercel auto-deploys to **touptigym-casa** production
- **Push to any other branch** → Vercel creates a **Preview deployment** (if enabled)

### Alternative: Single Vercel Project with Environments

If you prefer ONE Vercel project:
1. Create 1 Vercel project
2. Set `main` as Production branch
3. Add `casa` as a **Preview** branch
4. Configure different env vars per environment:
   - **Production** env → non-Casa credentials
   - **Preview** env → Casa credentials
5. Push to `casa` → creates a preview URL (e.g. `touptigym-casa.vercel.app`)
6. Push to `main` → updates production

---

## 📋 Quick Reference — What to do when...

| Situation | Action |
|-----------|--------|
| New feature for **both** databases | Create PR → merge to `main` → `git checkout casa && git merge main && git push` |
| New feature for **Casa only** | Create PR → merge to `casa` only |
| New feature for **Non-Casa only** | Create PR → merge to `main` only |
| Deploy edge functions to Casa | `npx supabase functions deploy <fn> --project-ref atvdorphwnpzhobvfmtz` |
| Deploy edge functions to Non-Casa | `npx supabase functions deploy <fn> --project-ref lpjdpcguplkpdfgxomps` |
| Update Casa database schema | Run SQL migrations on `atvdorphwnpzhobvfmtz` dashboard |
| Update Non-Casa database schema | Run SQL migrations on `lpjdpcguplkpdfgxomps` dashboard |
| Deploy frontend to Casa | Push to `casa` branch (Vercel auto-deploys) |
| Deploy frontend to Non-Casa | Push to `main` branch (Vercel auto-deploys) |

---

## 🚨 Important Warnings

1. **NEVER commit `.env` files** — they contain secrets and are gitignored
2. **ALWAYS sync code changes** between `main` and `casa` branches (merge or cherry-pick)
3. **Database migrations** must be run on BOTH Supabase projects separately
4. **Edge functions** must be deployed to BOTH Supabase projects separately
5. **The `data_base_casa/` folder** only exists on the `casa` branch — it contains Casa-specific Excel data files