# Migration Guide: lovable.dev to GitHub Pages

This guide covers the complete migration process from lovable.dev hosting to GitHub Pages.

## Overview

The migration involves:
1. Updating build configuration for GitHub Pages compatibility
2. Setting up GitHub Actions for automated deployment
3. Implementing SPA routing for GitHub Pages
4. Configuring environment variables for production

## Migration Steps

### Phase 1: Configuration Updates

#### 1.1 Update Vite Configuration
The `vite.config.ts` now includes:
- Dynamic base path reading from `VITE_BASE_URL` environment variable
- Default fallback to `/` for custom domain scenarios
- Production-ready build configuration

#### 1.2 Update package.json Scripts
New script added:
```bash
npm run build:gh  # Build with base path for GitHub Pages
```

### Phase 2: GitHub Actions Setup

#### 2.1 Create Deployment Workflow
- File: `.github/workflows/deploy.yml`
- Triggers: Push to main branch, pull requests
- Jobs: Build and deploy
- Security: Forks are prevented from deploying

#### 2.2 Configure GitHub Secrets
Add to Repository Settings → Secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_BASE_URL`
- `VITE_SYSTEM_ADMIN_EMAILS`

### Phase 3: SPA Routing Implementation

#### 3.1 Create 404.html
- Location: `public/404.html`
- Function: Redirects to `index.html` while preserving route
- Mechanism: Uses sessionStorage to store intended route

#### 3.2 Update App Component
- Added `RouteRestoration` component
- Checks sessionStorage for saved route
- Navigates to preserved route on load

### Phase 4: Testing and Deployment

#### 4.1 Local Testing
```bash
# Test build with GitHub Pages configuration
VITE_BASE_URL=/ npm run build:gh

# Preview locally
npm run preview
```

#### 4.2 Production Deployment
```bash
# Push to main branch
git add .
git commit -m "feat: Configure for GitHub Pages deployment"
git push origin main
```

## Changes Summary

### New Files Created
- `.github/workflows/deploy.yml` - GitHub Actions workflow
- `public/404.html` - SPA routing fallback
- `.env.example.github` - Environment variable template
- `docs/GITHUB_PAGES_SETUP.md` - Setup instructions
- `docs/MIGRATION_GUIDE.md` - This file

### Files Modified
- `vite.config.ts` - Added base path configuration
- `package.json` - Added build:gh script
- `src/App.tsx` - Added route restoration logic
- `vitest.config.ts` - Updated to include root-level tests

### Test Files Added
- `src/vite-configuration.test.ts` - Vite config characterization
- `src/package.scripts.test.ts` - Package scripts characterization
- `src/App.routing.test.tsx` - App routing characterization

## Backward Compatibility

### Local Development
The `npm run dev` command remains unchanged and continues to work as before.

### Existing Build
The `npm run build` command continues to work for development builds without GitHub Pages base path.

### lovable.dev Hosting
The existing lovable.dev deployment will continue to work during the transition period.

## Rollback Plan

If GitHub Pages deployment fails:

1. Revert changes to `vite.config.ts` and `package.json`
2. Remove `.github/workflows/deploy.yml`
3. Delete `public/404.html`
4. Remove route restoration from `App.tsx`
5. Continue using lovable.dev hosting

## Testing Checklist

Before considering migration complete:

- [ ] Local build succeeds with `npm run build:gh`
- [ ] All existing tests still pass
- [ ] New characterization tests pass
- [ ] GitHub Actions workflow completes successfully
- [ ] Application loads at GitHub Pages URL
- [ ] Direct URL navigation works (e.g., /admin)
- [ ] Assets load correctly
- [ ] Supabase connection works
- [ ] Authentication flow works
- [ ] Admin functions work correctly

## Performance Considerations

### GitHub Pages Performance
- Static hosting, no server-side processing
- CDN-backed content delivery
- Free SSL certificates included
- Limited to 100MB per repository

### Build Optimization
- Production builds exclude development-only plugins
- Asset minification enabled by default
- Code splitting maintained

## Security Considerations

### Environment Variables
- Secrets stored in GitHub Repository Secrets
- Never committed to version control
- Only exposed to client via VITE_ prefix

### Deployment Security
- Forks cannot deploy to production
- Requires admin access to configure
- GitHub Pages provides HTTPS automatically

## Monitoring and Maintenance

### GitHub Actions Monitoring
- Monitor workflow runs for failures
- Check deployment logs for errors
- Set up GitHub Actions notifications

### Application Monitoring
- Supabase logs for backend issues
- Browser console for client-side errors
- Network tab for asset loading issues

## Next Steps After Migration

1. **Monitor Performance**: Track load times and user experience
2. **Set Up Custom Domain**: Configure DNS if using custom domain
3. **Configure CDN**: Consider CDN for global performance
4. **Set Up Analytics**: Add analytics for user behavior tracking
5. **Backup Strategy**: Ensure regular backups of Supabase data

## Support

For issues with:
- **GitHub Pages**: Check GitHub Pages documentation
- **Vite Configuration**: Review Vite config docs
- **Supabase**: Consult Supabase support
- **This Migration**: Check issue tracker or create new issue

## Migration Timeline

| Phase | Duration | Dependencies |
|-------|-----------|--------------|
| Configuration Updates | 1-2 hours | None |
| GitHub Actions Setup | 2-4 hours | GitHub repository access |
| SPA Routing Implementation | 1-2 hours | Testing |
| Testing & Deployment | 2-4 hours | Complete configuration |
| Total | 6-12 hours | Linear progression |

## Success Criteria

Migration is considered successful when:

1. GitHub Actions workflow completes without errors
2. Application is accessible at GitHub Pages URL
3. All core functionality works as expected
4. No regression in existing features
5. Performance is acceptable for users
6. Security settings are properly configured

---

**Migration Version**: 1.0
**Last Updated**: 2026-03-16
**Compatible With**: Vite 5.4.x, React 18.x, GitHub Pages