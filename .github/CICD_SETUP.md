# CI/CD Setup Guide

This repository now includes a comprehensive GitHub Actions CI/CD pipeline with automated deployments to Netlify.

## Overview

The CI/CD pipeline provides:

- **Automated Testing**: All PRs are validated with tests, linting, and type checking
- **Preview Deployments**: Every PR gets a unique preview URL for testing
- **Production Deployments**: Automatic deployment to production on merge to main
- **AI Code Reviews**: Automated code review suggestions on PRs
- **Quality Gates**: All tests must pass before merging

## Workflows

### 1. PR Validation (`pr-validation.yml`)

**Triggers**: On pull request open/update

**What it does**:
- Installs Node.js 18 and Zig 0.15.1
- Runs `npm run verify` (typecheck + lint + test + test:wasm)
- Builds WASM and TypeScript
- Uploads build artifacts

**Status**: ✅ Required check - must pass before merge

### 2. Deploy Preview (`deploy-preview.yml`)

**Triggers**: On pull request open/update

**What it does**:
- Builds the complete project
- Deploys to Netlify preview environment
- Posts comment with preview URL (e.g., `https://pr-123--YOUR_SITE.netlify.app`)
- Preview includes HTTPS (required for WebGPU)

**Status**: ✅ Provides live preview URL for testing

### 3. Deploy Production (`deploy-production.yml`)

**Triggers**: On push to main/master branch

**What it does**:
- Runs full verification suite again
- Builds production bundle
- Deploys to Netlify production site
- Production URL: `https://YOUR_SITE.netlify.app`

**Status**: ✅ Automatic production deployment

### 4. AI Code Review (`ai-review.yml`)

**Triggers**: On pull request open/update

**What it does**:
- Uses AI to analyze code changes
- Posts review comments with suggestions
- Focuses on bugs, security issues, and improvements

**Status**: 🤖 Optional - provides AI-powered insights

## Setup Instructions

### Step 1: Netlify Setup

1. **Create Netlify Account**:
   - Go to [netlify.com](https://netlify.com)
   - Sign up for free (no credit card required)

2. **Create New Site**:
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub and select this repository
   - Build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Click "Deploy site"

3. **Get Netlify Credentials**:
   - **Site ID**: Found in Site settings → General → Site details → Site ID
   - **Auth Token**: Go to User settings → Applications → Personal access tokens → New access token

### Step 2: GitHub Secrets Setup

Add these secrets to your GitHub repository:

1. Go to repository Settings → Secrets and variables → Actions → New repository secret

2. Add the following secrets:

   | Secret Name | Value | Required For |
   |-------------|-------|--------------|
   | `NETLIFY_AUTH_TOKEN` | Your Netlify personal access token | Deployments |
   | `NETLIFY_SITE_ID` | Your Netlify site ID | Deployments |
   | `OPENAI_API_KEY` | OpenAI API key (optional) | AI Reviews |

**Note**: `OPENAI_API_KEY` is optional. If not provided, you can use CodeRabbit instead (see below).

### Step 3: Enable Branch Protection

Protect your main branch and require status checks:

1. Go to repository Settings → Branches
2. Add rule for `main` (or `master`)
3. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - Select required checks: `validate` (from pr-validation.yml)
4. Save changes

### Step 4: AI Code Review Options

**Option A: OpenAI GPT-4 (Paid)**
- Add `OPENAI_API_KEY` to GitHub secrets
- Workflow will use GPT-4 for code reviews
- Cost: ~$0.01-0.03 per review

**Option B: CodeRabbit (Free for Open Source)**
- Visit [coderabbit.ai](https://coderabbit.ai)
- Install CodeRabbit GitHub App
- Grant access to your repository
- Disable or comment out the `ai-review.yml` workflow
- CodeRabbit will automatically review all PRs

**Option C: Disable AI Reviews**
- Delete or disable `.github/workflows/ai-review.yml`
- Use manual code reviews only

## Usage

### Creating a Pull Request

1. Create a new branch:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Make changes and commit:
   ```bash
   git add .
   git commit -m "Add new feature"
   ```

3. Push to GitHub:
   ```bash
   git push origin feature/my-feature
   ```

4. Create PR on GitHub

5. **Automated Actions**:
   - ✅ PR Validation runs automatically
   - ✅ Preview deployment starts
   - 🤖 AI review posts suggestions
   - 💬 Comment appears with preview URL

6. **Testing Your Changes**:
   - Click the preview URL in the PR comment
   - Test your changes in the live preview environment
   - Preview includes HTTPS for WebGPU

7. **Before Merging**:
   - All checks must pass (green ✅)
   - Review AI suggestions
   - Get approval from team members

### Merging to Production

1. Click "Merge pull request" on GitHub
2. **Automated Actions**:
   - ✅ Production deployment runs
   - ✅ All tests run again
   - ✅ Build and deploy to production
   - 🚀 Live at `https://YOUR_SITE.netlify.app`

### Checking Deployment Status

**View Workflow Runs**:
- Go to repository → Actions tab
- See all workflow runs and their status

**View Netlify Deployments**:
- Go to Netlify dashboard
- See deployment history and status
- View deployment logs for debugging

**Production URL**:
- Visit `https://YOUR_SITE.netlify.app`
- Netlify provides the site name (you can customize it)

## Troubleshooting

### Build Failures

**Zig Not Found**:
- Check Zig version in workflow (should be 0.15.1)
- Update version in `.github/workflows/*.yml` if needed

**Tests Failing**:
- Run `npm run verify` locally
- Fix test failures before pushing
- Check workflow logs for details

**WASM Build Issues**:
- Verify `public/game_engine.wasm` is built
- Check Zig compilation step in workflow

### Deployment Issues

**Netlify Secrets Missing**:
- Verify `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` in GitHub secrets
- Check secret names match exactly (case-sensitive)

**Preview URL Not Working**:
- Check Netlify deployment logs
- Verify build succeeded
- HTTPS should work automatically (required for WebGPU)

**WASM Not Loading**:
- Check `netlify.toml` headers configuration
- Verify WASM MIME type is set correctly
- Check browser console for CORS errors

### AI Review Issues

**No AI Reviews**:
- Check if `OPENAI_API_KEY` is set (if using OpenAI)
- Or install CodeRabbit GitHub App
- Verify workflow has permissions to comment on PRs

**Review Quality**:
- Adjust model parameters in `ai-review.yml`
- Try different AI providers (CodeRabbit, GPT-4, etc.)
- Combine AI reviews with manual reviews

## Cost Estimates

### Free Tier Limits

**Netlify Free**:
- ✅ 100GB bandwidth/month
- ✅ 300 build minutes/month
- ✅ Unlimited preview deployments
- ✅ HTTPS included

**GitHub Actions Free**:
- ✅ 2,000 minutes/month for private repos
- ✅ Unlimited for public repos

**OpenAI (Optional)**:
- ❌ ~$0.01-0.03 per review (paid)

**CodeRabbit (Optional)**:
- ✅ Free for open source
- ❌ $12/user/month for private repos

### Recommended Setup

For **open source** projects:
- ✅ Use Netlify free tier
- ✅ Use GitHub Actions (unlimited)
- ✅ Use CodeRabbit (free)

For **private** projects:
- ✅ Use Netlify free tier
- ✅ Use GitHub Actions (2,000 min/month)
- ⚠️ Consider CodeRabbit ($12/user/month) or skip AI reviews

## Best Practices

1. **Always Create PRs**: Never push directly to main
2. **Test Preview URLs**: Verify changes in preview before merging
3. **Monitor Build Times**: Optimize if builds exceed free tier limits
4. **Review AI Suggestions**: AI helps but doesn't replace human review
5. **Keep Dependencies Updated**: Update Node.js and Zig versions as needed
6. **Monitor Production**: Check production site after each deployment

## File Structure

```
.github/
├── workflows/
│   ├── pr-validation.yml      # Test PRs
│   ├── deploy-preview.yml     # Deploy PR previews
│   ├── deploy-production.yml  # Deploy production
│   └── ai-review.yml          # AI code reviews
└── CICD_SETUP.md             # This file

netlify.toml                   # Netlify configuration
```

## Next Steps

1. ✅ Complete Netlify setup (Steps 1-2 above)
2. ✅ Add GitHub secrets
3. ✅ Create first PR to test workflows
4. ✅ Configure AI reviews (optional)
5. ✅ Set up branch protection
6. 🚀 Start using the pipeline!

## Support

- **GitHub Actions**: [docs.github.com/actions](https://docs.github.com/actions)
- **Netlify**: [docs.netlify.com](https://docs.netlify.com)
- **Zig**: [ziglang.org/documentation](https://ziglang.org/documentation/)
- **WebGPU**: [gpuweb.github.io/gpuweb](https://gpuweb.github.io/gpuweb/)

## Contributing

When contributing to this repository:

1. Create a feature branch
2. Make your changes
3. Run `npm run verify` locally
4. Push and create PR
5. Wait for all checks to pass
6. Address AI review suggestions
7. Get approval and merge

The CI/CD pipeline ensures code quality and prevents regressions!
