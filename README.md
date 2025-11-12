# Sarvesh's Blog

A clean, minimal blog built with vanilla HTML, CSS, and JavaScript. Features markdown-based posts with syntax highlighting, dark mode, search, and filtering.

## Features

- **Markdown-powered posts** - Write posts in markdown with automatic parsing
- **Dark mode** - Toggle between light and dark themes with persistent preference
- **Search & filter** - Find posts by title, excerpt, or tags
- **Reading progress** - Visual indicator of reading progress
- **Table of contents** - Auto-generated from post headings
- **Syntax highlighting** - Powered by Prism.js for code blocks
- **Responsive design** - Mobile-first, works on all devices
- **Fast & lightweight** - No build process, pure static site

## Tech Stack

- **Markdown Parser:** [marked.js](https://marked.js.org/)
- **Syntax Highlighting:** [Prism.js](https://prismjs.com/)
- **Fonts:** Inter, Lora, JetBrains Mono
- **Icons:** Font Awesome
- **Hosting:** GitHub Pages

## Adding New Posts

1. Create a new markdown file in the `posts/` directory:

```markdown
---
title: "Your Post Title"
date: "2025-01-20"
tags: ["AI", "Python", "Tutorial"]
excerpt: "A brief description of your post."
---

# Your Post Title

Your content here...
```

2. Add the post metadata to `script.js`:

```javascript
const articles = [
    {
        slug: 'your-post-slug',
        title: 'Your Post Title',
        date: '2025-01-20',
        excerpt: 'A brief description of your post.',
        tags: ['AI', 'Python', 'Tutorial'],
        readingTime: '8 min read'
    },
    // ... other articles
];
```

3. Commit and push - the post will be live!

## Local Development

Simply open `index.html` in a browser. For better local development with live reload:

```bash
# Using Python
python -m http.server 8000

# Or using Node.js
npx serve

# Then visit http://localhost:8000
```

## Customization

### Colors

Edit CSS variables in `style.css`:

```css
:root {
    --bg-primary: #FAFAF9;
    --text-primary: #18181B;
    --accent: #3B82F6;
    /* ... */
}
```

### Fonts

Change font imports in `index.html` and update CSS variables:

```css
--font-sans: 'Inter', sans-serif;
--font-serif: 'Lora', Georgia, serif;
```

### Layout

Modify responsive breakpoints and layouts in `style.css`.

## Project Structure

```
sarvesh-blog/
├── index.html          # Home page with article list
├── post.html           # Individual post template
├── style.css           # All styles and themes
├── script.js           # Article metadata and functionality
├── posts/              # Markdown blog posts
│   ├── building-production-rag-systems.md
│   ├── cloudeasym-lessons-learned.md
│   └── optimizing-data-pipelines.md
└── README.md           # This file
```

## License

MIT License - Feel free to use this template for your own blog!

## Contact

- **LinkedIn:** [sarvesh-ganesan09](https://linkedin.com/in/sarvesh-ganesan09)
- **GitHub:** [Sarvesh-GanesanW](https://github.com/Sarvesh-GanesanW)
- **Email:** sarveshganesan09@gmail.com
