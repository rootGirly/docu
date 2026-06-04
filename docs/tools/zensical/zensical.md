---
title: Zensical Setup
description: How I set up and themed this documentation site.
icon : lucide/file-code-corner
---

# Zensical Setup

[Official Documentation](https://zensical.org/docs/get-started/)

Future me, this is how you built this very site. If you ever spin up another Zensical project and forget the steps (you will), start here.

## Install it

Zensical is a Python tool, so keep it in a venv. Cleaner, reproducible, no breaking the system Python.



``` bash
mkdir docu && cd docu
python3 -m venv .venv
source .venv/bin/activate
pip install zensical
```

## Start a project

```bash
zensical new .
```

That gives you:

```
docu/
├── docs/
│   ├── index.md
│   └── markdown.md
└── zensical.toml
```

`docs/` = where the Markdown lives. `zensical.toml` = the control panel.

Always confirm it builds before touching anything:

```bash
zensical build
```

Output lands in `site/`.

## The config — `zensical.toml`

This is the whole file. Copy it, swap the values.

```toml
# ─────────────────────────────────────────────
#  byteGirl — Documentation
# ─────────────────────────────────────────────

[project]
logo = "images/logo.png"
site_name = "byteDocs"
site_description = "Security notes, homelab setup & methodology"
site_author = "byteGirl"
copyright = "&copy; 2026 byteDocs"
site_url = "https://docu.bytegirl.be"
extra_css = ["stylesheets/extra.css"]

# Enables icons + emojis
[project.markdown_extensions.attr_list]
[project.markdown_extensions.pymdownx.emoji]
[project.markdown_extensions.pymdownx.highlight]
anchor_linenums = true
line_spans = "__span"
pygments_lang_class = true
[project.markdown_extensions.pymdownx.inlinehilite]
[project.markdown_extensions.pymdownx.snippets]
[project.markdown_extensions.pymdownx.superfences]

[project.theme]
favicon = "img/favicon.png"
features = [
    "search.highlight",
    "content.code.copy",      # copy button 
    "content.code.select",    # lets readers select/link line ranges
    "navigation.top",         # back-to-top button
    "navigation.instant",     # SPA-style instant page loads
  ]
palette.scheme = "slate"
palette.primary = "custom"
palette.accent = "custom"
font.text = "JetBrains Mono"
font.code = "JetBrains Mono"

[project.theme.icon]
logo = "lucide/terminal"

```

Remember the trick: `palette.primary = "custom"` + `palette.accent = "custom"` is what frees Zensical to use your own colors instead of its defaults. Without those two lines, the CSS overrides don't fully take.

## The theme — `docs/stylesheets/extra.css`

Zensical is built on Material, which stores its colors as CSS variables. The clean way to re-skin it is to **override the variables**, not fight every element. Work *with* the framework.

```css
[data-md-color-scheme="slate"] {
  --md-default-bg-color:        #111113;
  --md-default-fg-color:        #d4d4d4;
  --md-default-fg-color--light: #6b7280;
  --md-default-fg-color--lighter: #6b7280;
  --md-default-fg-color--lightest: #252528;
etc...

```

## Writing pages

Markdown files go in `docs/`. Frontmatter at the top sets the title:

```md
---
title: Welcome
---

# 🚀 ~/notes

...your stuff...
```

Want a logo or icon on a page? Put the emoji or icon shortcode **in the body** — `:rocket:`, `:material-shield-lock:`, or just 🚀 in the heading. The emoji extension we enabled in the config makes those work.

## Preview before shipping

```bash
zensical build
zensical serve
```

Open `http://localhost:8000`. Serving the built `site/` folder directly is exactly how the real server treats it what you see is what ships.



## Final thought

The point of all this wasn't the tool, it was control. These notes live in plain Markdown, in my repo, on my server, styled like everything else I build. No login walls, no someone-else's-brand, no lock-in.

**Be your own guru**
