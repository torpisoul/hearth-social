# Deployment Guide

This project is configured to deploy automatically to Netlify using GitHub Actions.

## Prerequisites

To enable automated deployments, you need to configure the Netlify project and set up GitHub Secrets.

### 1. Netlify Project Setup

1.  Log in to your [Netlify account](https://app.netlify.com/).
2.  Create a new site ("Add new site" -> "Import an existing project" -> "GitHub" -> Select this repository).
3.  **Important:** Since we are using GitHub Actions for deployment, you should disable Netlify's automatic builds to avoid redundant deployments.
    *   Go to **Site settings** -> **Build & deploy**.
    *   Click **Stop builds** to disable the automatic build pipeline.
4.  Go to **Site settings** -> **Build & deploy** -> **Environment variables**.
5.  Add the following environment variables (required for backend functions):
    *   `SUPABASE_URL`: Your Supabase Project URL.
    *   `SUPABASE_SERVICE_KEY`: Your Supabase Service Role Key (needed for admin tasks).
    *   `JWT_SECRET`: The secret used for signing JWTs.

### 2. GitHub Secrets Setup

To allow GitHub Actions to deploy to your Netlify site, you need to provide authentication credentials.

1.  **Get Netlify Site ID:**
    *   In Netlify, go to **Site settings** -> **General** -> **Site details**.
    *   Copy the **Site ID** (e.g., `12345678-abcd-1234-abcd-1234567890ab`).

2.  **Get Netlify Auth Token:**
    *   Go to **User settings** (top right avatar) -> **Applications** -> **OAuth**.
    *   Click **New Access Token**.
    *   Give it a description (e.g., "GitHub Actions") and generate the token. Copy it immediately.

3.  **Add Secrets to GitHub:**
    *   In your GitHub repository, go to **Settings** -> **Secrets and variables** -> **Actions**.
    *   Click **New repository secret**.
    *   Add `NETLIFY_SITE_ID` with the Site ID you copied.
    *   Add `NETLIFY_AUTH_TOKEN` with the Access Token you generated.

## Automated Deployment

Once configured:
*   **Production:** Pushing to the `main` branch will automatically trigger a production deployment.
*   **Preview:** Opening a Pull Request against `main` will trigger a preview deployment.

## Custom Domain & SSL

1.  In Netlify, go to **Domain management**.
2.  Click **Add a domain** and enter your custom domain name.
3.  Follow the instructions to configure your DNS records (usually creating a CNAME or A record pointing to Netlify).
4.  **SSL:** Netlify automatically provisions a Let's Encrypt SSL certificate once the DNS is verified. You can verify this in the **HTTPS** section under Domain management.
