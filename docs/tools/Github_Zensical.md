---
icon: simple/github
title: CI/CD
description: How this site auto-deploys to the VPS on every push.
---

## Continous Integration - Continuous deployment

This is how this very site ships itself. Push to `main`, and GitHub Actions builds it and rsyncs it to the VPS. No manual uploads, no forgetting a step. If you ever rebuild this pipeline, start here.

## How it flows

```text
local: write markdown
  └─ git push
       └─ GitHub Actions: zensical build → site/
            └─ rsync site/ → server:/your/folder/docu/
                 └─ HTTP server serves docu.bytegirl.be over HTTPS
```

The whole thing is static files. My HTTP server just serves a folder no server process running for the docs.

##  `.gitignore`

Don't commit the venv, the build output, or OS junk. CI rebuilds `site/` every time, so it never belongs in the repo.

```gitignore
# python
.venv/
__pycache__/
*.pyc

# zensical build output (CI rebuilds it)
site/

# os / editor junk
.DS_Store
.vscode/
.idea/
```

## Dedicated deploy key

One key per repo. If a key leaks, you revoke one thing, not your whole identity. Generate it locally:

```bash
ssh-keygen -t ed25519 -C "github-deploy-docu" -f ~/.ssh/docu_deploy -N ""
```

Authorize the **public** half on the VPS (the private half never leaves your control):

```bash
ssh-copy-id -i ~/.ssh/docu_deploy.pub your-user@your-vps-ip
```

## The workflow

Lives at `.github/workflows/deploy.yml`.

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read          # least privilege: read the repo, nothing else

concurrency:
  group: deploy-docu       # never two deploys at once
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install Zensical
        run: |
          python -m venv .venv
          source .venv/bin/activate
          pip install zensical

      - name: Build
        run: |
          source .venv/bin/activate
          zensical build

      # Fail loud if the build produced no pages, instead of shipping an empty site
      - name: Verify build output
        run: test -f site/index.html || (echo "::error::Build produced no index.html" && exit 1)

      - name: Setup SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.DEPLOY_SSH_KEY }}" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          echo "${{ secrets.VPS_KNOWN_HOSTS }}" > ~/.ssh/known_hosts
          chmod 644 ~/.ssh/known_hosts

      - name: Deploy via rsync
        run: |
          rsync -avz --delete \
            -e "ssh -i ~/.ssh/deploy_key -o IdentitiesOnly=yes -o UserKnownHostsFile=~/.ssh/known_hosts" \
            site/ \
            ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/your/folder/docu/

      - name: Cleanup SSH key
        if: always()
        run: rm -f ~/.ssh/deploy_key
```

Two things to remember about this one:

- The **Verify build output** step is the safety net. Zensical can report success but produce no `index.html`. Without this check, the `--delete` flag would wipe the live site and replace it with nothing. The check fails the job instead.
- The rsync target folder is `/your/folder/docu/` (the folder name on disk) even though the public domain is `docu.mydomain.be`. That's intentional — it matches the HTTP server setup. Don't "fix" it.

## Secrets

In the repo: **Settings → Secrets and variables → Actions**.

| Secret | Value |
| --- | --- |
| `DEPLOY_SSH_KEY` | the private key (`~/.ssh/docu_deploy`, whole file) |
| `VPS_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 your-vps-ip` |
| `VPS_USER` | the VPS username |
| `VPS_HOST` | the VPS IP (must match what you scanned) |

The host key is the anti-MITM piece — it lets the runner confirm it's really talking to your server. Scan the same host you put in `VPS_HOST`:

```bash
ssh-keyscan -t ed25519 your-vps-ip | grep -v '^#' | pbcopy
```

## Push

```bash
git init
git branch -M main
git add .
git status        # check: no .venv/, no site/, no .DS_Store
git commit -m "Initial commit: byteGirl documentation"
git remote add origin git@github.com:rootGirly/docu.git
git push -u origin main
```

Then watch the **Actions** tab.

## The HTTP server side

On the server, HTTP server serves the deployed folder:

```text
docu.mydomain.be {
    root * /my/folder/docu
    file_server
    encode gzip
}
```

Validate your HTTP file before reloading so a typo never takes the site down and use the HTTPS.

## Youpi!

The nicest part isn't the automation, it's that updating the docs is now just *writing*. Open a markdown file, write the thing I'll forget, `git push`, done. The pipeline disappears into the background, which is exactly where good infrastructure belongs.


