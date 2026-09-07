# WasteWise Google OAuth Setup

WasteWise now uses a server-side Google OAuth 2.0 authorization-code flow. The browser starts the flow at `/api/auth/google/start`; the server exchanges the authorization code, verifies Google's ID token, upserts the user in the database, creates a signed HTTP-only session cookie, and redirects back to the app.

## Environment variables

Set these in the WebDev project/server environment. Do not commit them to source control or expose the secret through a `VITE_` variable.

| Variable | Required value |
|---|---|
| `DATABASE_URL` | The provisioned MySQL/TiDB connection string. This is already supplied by the full-stack WebDev environment. |
| `JWT_SECRET` | A long, random server-only secret used to sign session cookies. The WebDev environment already supplies one; replace it only if you intentionally rotate sessions. |
| `GOOGLE_CLIENT_ID` | The Google OAuth Web application client ID. |
| `GOOGLE_CLIENT_SECRET` | The Google OAuth Web application client secret. Server-only. |
| `GOOGLE_CALLBACK_URL` | The exact callback URL registered in Google Cloud, for example `http://localhost:3000/api/auth/google/callback` during local development or `https://your-domain.example/api/auth/google/callback` in production. |
| `ADMIN_EMAILS` | Comma-separated verified Google email addresses that should receive the `admin` role on sign-in. All other accounts receive `student`. |

The callback URL must match the Google Cloud configuration exactly, including scheme, hostname, port, path, and trailing-slash behavior.

## Google Cloud Console steps

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select the project that will own WasteWise OAuth.
2. Open **APIs & Services → OAuth consent screen**.
3. Choose **External** unless all users belong to a managed Google Workspace organization. Enter the application name `WasteWise`, add a support email, and provide a developer contact email.
4. Add the scopes `openid`, `email`, and `profile`. These are the only scopes used by the implementation.
5. If the consent screen is in **Testing** mode, add every Google account that will test the app under **Test users**. A testing-mode app will not allow arbitrary accounts to sign in.
6. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**.
7. Select **Web application** as the application type and name it `WasteWise Web`.
8. Under **Authorized JavaScript origins**, add the origin only, without a path. Examples: `http://localhost:3000` and `https://your-domain.example`.
9. Under **Authorized redirect URIs**, add the exact callback URL. Examples: `http://localhost:3000/api/auth/google/callback` and `https://your-domain.example/api/auth/google/callback`.
10. Create the client, copy the client ID into `GOOGLE_CLIENT_ID`, and copy the client secret into `GOOGLE_CLIENT_SECRET`. Do not put either value in React source or any `VITE_` variable.
11. Set `GOOGLE_CALLBACK_URL` to the same exact redirect URI and set `ADMIN_EMAILS` to the administrator email address or addresses.
12. Run the database migration, restart the server, and open the app. The login screen will enable **Continue with Google** only after the server sees both Google credentials.

## Database migration and local run

From the project directory:

```bash
pnpm install
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
pnpm check
pnpm build
pnpm dev
```

The first Google sign-in creates a row in `users` with `id`, `name`, `email`, `profileImageUrl`, `role`, `createdAt`, and the Google subject identifier. Roles are read from the database on every request. Changing client state cannot grant admin access.

## Verification checklist

- `/api/auth/google/config` returns `{ "configured": true }` only when both Google server credentials are present.
- With credentials configured, `/api/auth/google/start` redirects to Google and returns to `/api/auth/google/callback`.
- The callback rejects missing or mismatched OAuth state.
- The callback rejects unverified or incomplete Google identity claims.
- A successful callback sets an HTTP-only signed session cookie and redirects to `/`.
- `auth.me` returns the persistent user record.
- `admin.access` returns success only for a database user whose role is `admin`; students receive `FORBIDDEN`.
- Sign out clears the session cookie and the next `auth.me` request returns `null`.

Google OAuth cannot be considered live until the project owner supplies the Google client credentials, configures the exact callback URL in Google Cloud, and completes one end-to-end sign-in test.
