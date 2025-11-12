/**
 * Blog Site JavaScript
 * Handles article loading, filtering, search, dark mode, and more
 */

// Article metadata - Add your articles here
const articles = [
    {
        slug: 'building-production-rag-systems',
        title: 'Building Production RAG Systems: Lessons from 10K+ Daily Queries',
        date: '2025-01-15',
        excerpt: 'How we reduced RAG query latency from 2.5s to 400ms while scaling to handle thousands of daily queries in production.',
        tags: ['AI', 'RAG', 'Python', 'Tutorial'],
        readingTime: '12 min read'
    },
    {
        slug: 'cloudeasym-lessons-learned',
        title: 'CloudeasyML: Lessons from Building an MLOps Platform',
        date: '2025-01-10',
        excerpt: 'Key insights and architectural decisions from building a production MLOps platform on AWS.',
        tags: ['MLOps', 'AWS', 'Python'],
        readingTime: '10 min read'
    },
    {
        slug: 'optimizing-data-pipelines',
        title: 'Optimizing Data Pipelines: From Hours to Minutes',
        date: '2025-01-05',
        excerpt: 'A case study on optimizing a slow data pipeline using DuckDB, reducing processing time by 95%.',
        tags: ['Data Engineering', 'Python', 'Tutorial'],
        readingTime: '8 min read'
    }
];

// ==========================================
// Dark Mode
// ==========================================

/**
 * Initializes dark mode functionality
 */
function initializeDarkMode() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle.querySelector('i');
    const currentTheme = localStorage.getItem('blog-theme') || 'light';

    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
    }

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');

        if (document.body.classList.contains('dark-mode')) {
            themeIcon.classList.replace('fa-moon', 'fa-sun');
            localStorage.setItem('blog-theme', 'dark');
        } else {
            themeIcon.classList.replace('fa-sun', 'fa-moon');
            localStorage.setItem('blog-theme', 'light');
        }
    });
}

// ==========================================
// Home Page - Article List
// ==========================================

/**
 * Renders article cards on the home page
 */
function renderArticles(articlesToRender = articles) {
    const grid = document.getElementById('articles-grid');
    const noResults = document.getElementById('no-results');

    if (articlesToRender.length === 0) {
        grid.innerHTML = '';
        noResults.style.display = 'block';
        return;
    }

    noResults.style.display = 'none';

    grid.innerHTML = articlesToRender.map(article => `
        <article class="article-card" onclick="window.location.href='post.html?slug=${article.slug}'">
            <div class="article-date">${formatDate(article.date)}</div>
            <h3 class="article-title">
                <a href="post.html?slug=${article.slug}">${article.title}</a>
            </h3>
            <p class="article-excerpt">${article.excerpt}</p>
            <div class="article-meta">
                <span>${article.readingTime}</span>
            </div>
            <div class="article-tags">
                ${article.tags.map(tag => `<span class="article-tag">${tag}</span>`).join('')}
            </div>
        </article>
    `).join('');
}

/**
 * Formats date string
 */
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

/**
 * Initializes filter functionality
 */
function initializeFilters() {
    const filterButtons = document.querySelectorAll('.tag[data-tag]');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const tag = button.dataset.tag;

            if (tag === 'all') {
                renderArticles(articles);
            } else {
                const filtered = articles.filter(article =>
                    article.tags.includes(tag)
                );
                renderArticles(filtered);
            }
        });
    });
}

/**
 * Initializes search functionality
 */
function initializeSearch() {
    const searchInput = document.getElementById('search-input');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();

        if (query === '') {
            // Reset to current filter
            const activeFilter = document.querySelector('.tag.active');
            const tag = activeFilter ? activeFilter.dataset.tag : 'all';

            if (tag === 'all') {
                renderArticles(articles);
            } else {
                const filtered = articles.filter(article =>
                    article.tags.includes(tag)
                );
                renderArticles(filtered);
            }
            return;
        }

        const results = articles.filter(article =>
            article.title.toLowerCase().includes(query) ||
            article.excerpt.toLowerCase().includes(query) ||
            article.tags.some(tag => tag.toLowerCase().includes(query))
        );

        renderArticles(results);
    });
}

// ==========================================
// Post Page - Markdown Loading
// ==========================================

/**
 * Loads and renders a blog post from markdown
 */
async function loadPost() {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');

    if (!slug) {
        showError('No article specified');
        return;
    }

    const article = articles.find(a => a.slug === slug);

    if (!article) {
        showError('Article not found');
        return;
    }

    try {
        // Fetch markdown file
        const response = await fetch(`posts/${slug}.md`);

        if (!response.ok) {
            throw new Error('Failed to load article');
        }

        const markdown = await response.text();

        // Parse markdown (remove frontmatter if present)
        const content = markdown.replace(/^---[\s\S]*?---\n/, '');

        // Convert markdown to HTML
        const html = marked.parse(content);

        // Update page
        document.getElementById('post-title').textContent = article.title;
        document.getElementById('post-date').textContent = formatDate(article.date);
        document.getElementById('post-reading-time').textContent = article.readingTime;
        document.getElementById('post-excerpt').textContent = article.excerpt;
        document.getElementById('post-tags').innerHTML = article.tags
            .map(tag => `<span class="post-tag">${tag}</span>`)
            .join('');
        document.getElementById('post-content').innerHTML = html;

        // Update meta tags for SEO and social sharing
        const currentUrl = `https://sarvesh-ganesanw.github.io/sarvesh-blog/post.html?slug=${slug}`;

        document.title = `${article.title} - Sarvesh Ganesan`;
        document.getElementById('meta-description').content = article.excerpt;
        document.getElementById('meta-keywords').content = article.tags.join(', ');
        document.getElementById('canonical-url').href = currentUrl;

        // Open Graph tags
        document.getElementById('og-url').content = currentUrl;
        document.getElementById('og-title').content = article.title;
        document.getElementById('og-description').content = article.excerpt;
        document.getElementById('article-published').content = new Date(article.date).toISOString();

        // Twitter Card tags
        document.getElementById('twitter-title').content = article.title;
        document.getElementById('twitter-description').content = article.excerpt;

        // Apply syntax highlighting
        Prism.highlightAll();

        // Generate table of contents
        generateTOC();

        // Setup share buttons
        setupShareButtons(article);

        // Show article
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('post-article').style.display = 'block';

    } catch (error) {
        console.error('Error loading post:', error);
        showError('Failed to load article. Please try again.');
    }
}

/**
 * Shows error message
 */
function showError(message) {
    const loadingState = document.getElementById('loading-state');
    loadingState.innerHTML = `
        <div class="loading">
            <i class="fas fa-exclamation-circle" style="color: var(--accent);"></i>
            <p>${message}</p>
            <a href="index.html" style="margin-top: 1rem; display: inline-block;">← Back to Articles</a>
        </div>
    `;
}

/**
 * Generates table of contents from headings
 */
function generateTOC() {
    const content = document.getElementById('post-content');
    const headings = content.querySelectorAll('h2, h3');

    if (headings.length < 3) {
        return; // Don't show TOC for short articles
    }

    const toc = document.getElementById('toc');
    const tocContainer = document.getElementById('toc-container');

    const tocHTML = Array.from(headings).map((heading, index) => {
        const id = `heading-${index}`;
        heading.id = id;

        const level = heading.tagName === 'H2' ? 0 : 1;
        const indent = level * 1;

        return `<li style="margin-left: ${indent}rem;">
            <a href="#${id}">${heading.textContent}</a>
        </li>`;
    }).join('');

    toc.innerHTML = `<ul>${tocHTML}</ul>`;
    tocContainer.style.display = 'block';

    // TOC toggle
    const tocToggle = document.getElementById('toc-toggle');
    tocToggle.addEventListener('click', () => {
        toc.style.display = toc.style.display === 'none' ? 'block' : 'none';
        const icon = tocToggle.querySelector('i');
        icon.classList.toggle('fa-chevron-up');
        icon.classList.toggle('fa-chevron-down');
    });
}

/**
 * Sets up social share buttons
 */
function setupShareButtons(article) {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(article.title);
    const text = encodeURIComponent(article.excerpt);

    document.getElementById('share-twitter').href =
        `https://twitter.com/intent/tweet?text=${title}&url=${url}`;

    document.getElementById('share-linkedin').href =
        `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;

    document.getElementById('share-facebook').href =
        `https://www.facebook.com/sharer/sharer.php?u=${url}`;
}

/**
 * Initializes reading progress bar
 */
function initializeReadingProgress() {
    const progressBar = document.getElementById('reading-progress-bar');

    if (!progressBar) return;

    window.addEventListener('scroll', () => {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight - windowHeight;
        const scrolled = window.scrollY;
        const progress = (scrolled / documentHeight) * 100;

        progressBar.style.width = `${Math.min(progress, 100)}%`;
    });
}

// ==========================================
// Initialize
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize dark mode on all pages
    initializeDarkMode();

    // Check which page we're on
    const isPostPage = document.body.classList.contains('post-page');

    if (isPostPage) {
        // Post page
        loadPost();
        initializeReadingProgress();
    } else {
        // Home page
        renderArticles();
        initializeFilters();
        initializeSearch();
    }
});
