# GitHub Pages Setup Guide

This guide walks through the setup required for deploying the React/Vite application to GitHub Pages.

## Prerequisites

- GitHub repository with admin access
- Node.js 20 LTS or higher
- npm or yarn package manager
- Supabase project credentials

## Step 1: Enable GitHub Pages

1. Go to your repository Settings → Pages
2. Under "Build and deployment", select "GitHub Actions" as the source
3. Click Save

## Step 2: Configure GitHub Secrets

Add the following secrets to your repository Settings → Secrets and variables → Actions:

| Secret Name | Description | Required |
|-------------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key | Yes |
| `VITE_SUPABASE_PROJECT_ID` | Your Supabase project ID | Yes |
| `VITE_BASE_URL` | GitHub Pages base path (usually "/") | Yes |
| `VITE_SYSTEM_ADMIN_EMAILS` | Comma-separated admin emails | Yes |

### How to Find Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the Project URL and anon/public key
4. The Project ID is in your project URL (e.g., `gtudnbdtcvmzsvrzvdoz`)

### VITE_BASE_URL Configuration

- **Custom Domain**: Set `VITE_BASE_URL=/`
- **Default GitHub Pages**: Set `VITE_BASE_URL=/your-repo-name`

Example for `username.github.io/your-repo-name`:
```
VITE_BASE_URL=/your-repo-name
```

## Step 3: Update .env.example.github

1. Copy `.env.example.github` to `.env`
2. Fill in your actual Supabase credentials
3. Use this for local development

## Step 4: Test Deployment

1. Push your changes to the `main` branch
2. Go to Actions tab in your repository
3. Watch the "Deploy to GitHub Pages" workflow run
4. Once complete, your app will be available at:
   - Custom domain: `https://your-domain.com`
   - Default: `https://username.github.io/repository-name`

## Custom Domain Setup (Optional)

If using a custom domain:

1. Add your custom domain in GitHub Pages settings
2. Configure DNS records as instructed by GitHub
3. Set `VITE_BASE_URL=/` in GitHub Secrets
4. Set `VITE_BASE_URL=/` in your local `.env` file

## Troubleshooting

### Build Fails

- Check that all required secrets are set
- Verify Supabase credentials are correct
- Check Actions logs for specific error messages

### 404 Errors on Deep Links

- Ensure `404.html` exists in `public/` directory
- Verify `RouteRestoration` component is in `App.tsx`
- Clear browser cache and try again

### Assets Not Loading

- Check `VITE_BASE_URL` matches your deployment URL
- Verify build completed successfully in Actions
- Inspect browser network tab for 404 errors on assets

### SPA Routes Not Working

- Ensure GitHub Pages source is set to "GitHub Actions"
- Verify `.github/workflows/deploy.yml` exists
- Check that deployment workflow completed successfully

## Next Steps

- [ ] Enable GitHub Pages
- [ ] Add GitHub Secrets
- [ ] Test local build with `npm run build:gh`
- [ ] Push to main and verify deployment
- [ ] Set up custom domain (if applicable)

## Additional Resources

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Vite Base Path Documentation](https://vitejs.dev/config/shared-options.html#base)
- [Supabase Client Setup](https://supabase.com/docs/guides/with-react)