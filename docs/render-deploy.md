# Render Deploy Notes

This repo is configured for Render with `render.yaml`.

## Backend service

Render service: `twins-through-time-api`

Required environment variables:

```env
JWT_SECRET=generate-a-long-random-string
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
WORKER_SECRET=generate-a-long-random-string
GROQ_API_KEY=your_groq_api_key
ALLOWED_ORIGINS=https://your-frontend-service.onrender.com
```

Optional:

```env
GROQ_MODEL=llama-3.1-8b-instant
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
```

The backend build installs Node dependencies and the lightweight Python scraper dependencies:

```sh
npm install --prefix backend && python3 -m pip install -r llm/requirements.txt
```

The backend service intentionally builds from the repository root. Do not set its Render root directory to `backend`, because the Python worker also needs the root-level `scraping/` and `llm/` folders at runtime.

The Python worker posts back to the same Render web service through the local runtime port by default, so `INTERNAL_API_URL` is usually not needed.

## Frontend static site

Render service: `twins-through-time-frontend`

Required environment variables:

```env
VITE_API_BASE_URL=https://your-backend-service.onrender.com
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

`VITE_API_BASE_URL` can be set either with or without `/api`; the frontend normalizes both forms.

## Notes

Render free web services can spin down when idle. A long scrape running in the background can be interrupted if the service is stopped or redeployed. For reliable long-running scrape jobs, use a paid web service or move scraping into a dedicated Render background worker.
