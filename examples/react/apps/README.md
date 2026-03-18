# Apps

This example plans two APP host apps:

- `backend` for Node API execution and local persistence ownership
- `portal` for React UI execution

Each host keeps the canonical APP files:

- `app.ts`
- `registry.ts`

Additional runtime entry files may exist when the host runtime needs them:

- `server.ts` for the backend process entrypoint
- `main.tsx` and `vite.config.ts` for the portal runtime
