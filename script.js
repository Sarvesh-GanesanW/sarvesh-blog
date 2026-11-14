/**
 * Notes by Sarvesh Ganesan.
 *
 * NOTES below is the one list of posts: the register (index.html) and the
 * reading sheet (post.html?slug=<slug>) are both built from it. A post's text
 * lives in posts/<slug>.md and is fetched and rendered with marked and Prism.
 */

const SITE_URL = 'https://sarvesh-ganesanw.github.io/sarvesh-blog/';
const WORDS_PER_MINUTE = 220;
const ALL_TOPICS = 'all';
const SECTION_TRACK_OFFSET_PX = 120;
const WIDE_SHEET_QUERY = '(min-width: 1181px)';

/**
 * Every post, newest or oldest in any order (the register sorts by date).
 * - keyPlan: the schematic drawn beside it in the register (see KEY_PLANS);
 *   posts without one get the generic sheet.
 * - earlier: listed under "Earlier notes" with title and date only.
 * - hasFigure: the post contains an interactive figure.
 */
const NOTES = [
    {
        slug: 'hybrid-retrieval-rag-latency',
        title: 'Cutting RAG latency from ~10 s to under 1 s with hybrid retrieval',
        date: '2026-11-14',
        excerpt: 'Vector and full-text search in one Postgres query, a neural reranker with a hard timeout, and OCR only for the pages that need it.',
        tags: ['AI', 'RAG', 'Python'],
        keyPlan: 'hybrid-retrieval'
    },
    {
        slug: 'cheaper-llm-calls-cost-ledger',
        title: 'Making LLM calls cheaper without making answers worse',
        date: '2026-11-13',
        excerpt: 'Routing requests by complexity, caching prompts in four places, a per-call cost ledger with reserve-and-settle budgets, and moving background jobs to a lighter model.',
        tags: ['AI', 'Python'],
        keyPlan: 'cost-ledger'
    },
    {
        slug: 'headroom-scaler-nodes-before-pods',
        title: 'Adding nodes before pods exist: headroom-scaler',
        date: '2026-11-12',
        excerpt: 'A Kubernetes node autoscaler that keeps bin-packed headroom per PriorityClass, provisions declared demand ahead of time, and never evicts or binds a pod.',
        tags: ['Kubernetes', 'AWS', 'Python'],
        keyPlan: 'headroom',
        hasFigure: true
    },
    {
        slug: 'building-production-rag-systems',
        title: 'Building production RAG systems',
        date: '2025-01-15',
        excerpt: 'How we reduced RAG query latency from 2.5s to 400ms while scaling to handle thousands of daily queries in production.',
        tags: ['AI', 'RAG', 'Python', 'Tutorial'],
        earlier: true
    },
    {
        slug: 'cloudeasym-lessons-learned',
        title: 'CloudeasyML: lessons from building an MLOps platform',
        date: '2025-01-10',
        excerpt: 'Key insights and architectural decisions from building a production MLOps platform on AWS.',
        tags: ['MLOps', 'AWS', 'Python'],
        earlier: true
    },
    {
        slug: 'optimizing-data-pipelines',
        title: 'Optimizing data pipelines: from hours to minutes',
        date: '2025-01-05',
        excerpt: 'A case study on optimizing a slow data pipeline using DuckDB, reducing processing time by 95%.',
        tags: ['Data Engineering', 'Python', 'Tutorial'],
        earlier: true
    }
];

/** Interactive figures a post can mount with <figure class="js-figure" data-figure="<name>">. */
const FIGURES = {
    'headroom-demand': './figures/headroom-demand.js'
};

/** Register thumbnails, drawn in a 200 x 110 box with white linework. */
const KEY_PLANS = {
    'hybrid-retrieval': `
        <path class="ln" d="M6 55 H20 V22 H34 M20 55 V88 H34"/>
        <rect class="ln" x="34" y="12" width="64" height="22"/><rect class="ln" x="34" y="77" width="64" height="22"/>
        <path class="ln" d="M98 22 H114 V55 M98 88 H114 V55 H122" marker-end="url(#arr-s)"/>
        <circle class="ln" cx="134" cy="55" r="11"/>
        <line class="ln" x1="145" y1="55" x2="156" y2="55"/>
        <rect class="hatch" x="156" y="44" width="38" height="22"/><rect class="ln" x="156" y="44" width="38" height="22"/>`,
    'cost-ledger': `
        <line class="ln" x1="6" y1="92" x2="194" y2="92" marker-end="url(#arr-s)"/>
        <path class="ln dash" d="M20 14 V98 M170 14 V98"/>
        <rect class="ln dash" x="20" y="24" width="150" height="22"/>
        <rect class="hatch" x="20" y="56" width="90" height="22"/><rect class="ln" x="20" y="56" width="90" height="22"/>`,
    headroom: `
        <rect class="ln" x="8" y="8" width="40" height="94"/><rect class="solid" x="12" y="56" width="32" height="42"/><rect class="hatch" x="12" y="32" width="32" height="20"/>
        <rect class="ln" x="56" y="8" width="40" height="94"/><rect class="solid" x="60" y="70" width="32" height="28"/><rect class="hatch" x="60" y="46" width="32" height="20"/>
        <rect class="ln" x="104" y="8" width="40" height="94"/><rect class="solid" x="108" y="80" width="32" height="18"/><rect class="hatch" x="108" y="56" width="32" height="20"/>
        <rect class="ln dash" x="152" y="8" width="40" height="94"/><rect class="ln dash thin" x="156" y="60" width="32" height="38"/>`,
    // A blank sheet with its own title block: for posts that have no drawing yet.
    generic: `
        <rect class="ln" x="8" y="8" width="184" height="94"/>
        <path class="ln thin" d="M22 26 H120 M22 40 H104 M22 54 H112 M22 68 H92"/>
        <rect class="ln" x="136" y="66" width="56" height="36"/>
        <path class="ln thin" d="M136 84 H192 M164 66 V102"/>`
};

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// ==========================================================================
// Shared helpers
// ==========================================================================

/** Notes newest first, each with its drawing number (N1 is the oldest). */
function numberedNotes() {
    const oldestFirst = [...NOTES].sort((a, b) => a.date.localeCompare(b.date));
    const numbered = oldestFirst.map((note, index) => ({ ...note, number: `N${index + 1}` }));
    return numbered.reverse();
}

function formatDate(isoDate) {
    return DATE_FORMAT.format(new Date(`${isoDate}T00:00:00Z`));
}

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function postHref(slug) {
    return `post.html?slug=${encodeURIComponent(slug)}`;
}

function keyPlanSvg(name) {
    const drawing = KEY_PLANS[name] ?? KEY_PLANS.generic;
    return `<svg class="sch" viewBox="0 0 200 110" aria-hidden="true" focusable="false">${drawing}</svg>`;
}

// ==========================================================================
// Register (index.html)
// ==========================================================================

function topicCounts(notes) {
    const counts = new Map();
    notes.forEach((note) => note.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function renderTopicChoices(notes) {
    const choices = [[ALL_TOPICS, notes.length], ...topicCounts(notes)];
    document.getElementById('topic-list').innerHTML = choices.map(([topic, count], index) => {
        const id = `topic-${index}`;
        const label = topic === ALL_TOPICS ? 'All topics' : topic;
        return `<span class="layer">
            <input type="radio" name="topic" id="${id}" value="${escapeHtml(topic)}"${topic === ALL_TOPICS ? ' checked' : ''}>
            <label for="${id}">${escapeHtml(label)} <span class="count">${count}</span></label>
        </span>`;
    }).join('');
}

function matchesFilter(note, { query, topic }) {
    if (topic !== ALL_TOPICS && !note.tags.includes(topic)) return false;
    if (!query) return true;
    const haystack = [note.title, note.excerpt, note.number, ...note.tags].join(' ').toLowerCase();
    return query.split(/\s+/).every((word) => haystack.includes(word));
}

function currentRow(note) {
    const figureLine = note.hasFigure ? '<span class="aside">Includes a figure you can move</span>' : '';
    return `<tr>
        <td class="no">${note.number}</td>
        <td class="plan">${keyPlanSvg(note.keyPlan)}</td>
        <td class="title"><a href="${postHref(note.slug)}">${escapeHtml(note.title)}</a>
            <p>${escapeHtml(note.excerpt)}</p>${figureLine}</td>
        <td class="date"><time datetime="${note.date}">${formatDate(note.date)}</time></td>
        <td class="rev">First issue</td>
    </tr>`;
}

function earlierRow(note) {
    return `<tr>
        <td class="no">${note.number}</td>
        <td class="title"><a href="${postHref(note.slug)}">${escapeHtml(note.title)}</a></td>
        <td class="date"><time datetime="${note.date}">${formatDate(note.date)}</time></td>
    </tr>`;
}

function describeFilter({ query, topic }) {
    const parts = [];
    if (query) parts.push(`“${query}”`);
    if (topic !== ALL_TOPICS) parts.push(`the ${topic} topic`);
    return parts.join(' in ');
}

function renderRegister(notes, filter) {
    const shown = notes.filter((note) => matchesFilter(note, filter));
    const current = shown.filter((note) => !note.earlier);
    const earlier = shown.filter((note) => note.earlier);

    document.getElementById('current-rows').innerHTML = current.map(currentRow).join('');
    document.getElementById('earlier-rows').innerHTML = earlier.map(earlierRow).join('');
    document.getElementById('register-current').hidden = current.length === 0;
    document.getElementById('register-earlier').hidden = earlier.length === 0;

    const isEmpty = shown.length === 0;
    document.getElementById('register-empty').hidden = !isEmpty;
    if (isEmpty) {
        document.getElementById('empty-detail').textContent =
            `Nothing in the register matches ${describeFilter(filter)}. Try a shorter phrase or another topic, or show every note.`;
    }

    const isFiltered = filter.query || filter.topic !== ALL_TOPICS;
    document.getElementById('register-count').innerHTML = isFiltered
        ? `Drawing register, <b>${shown.length}</b> of ${notes.length} notes`
        : `Drawing register, <b>${notes.length}</b> notes`;
}

function initRegister() {
    const notes = numberedNotes();
    const searchInput = document.getElementById('search-input');
    const clearButton = document.getElementById('clear-search');
    const filter = { query: '', topic: ALL_TOPICS };

    document.getElementById('last-issue').textContent = formatDate(notes[0].date);
    document.getElementById('note-count').textContent = String(notes.length);
    renderTopicChoices(notes);
    renderRegister(notes, filter);

    const update = () => {
        filter.query = searchInput.value.trim().toLowerCase();
        clearButton.disabled = searchInput.value === '';
        renderRegister(notes, filter);
    };
    searchInput.addEventListener('input', update);
    document.getElementById('finder').addEventListener('submit', (event) => event.preventDefault());
    document.getElementById('topic-list').addEventListener('change', (event) => {
        filter.topic = event.target.value;
        update();
    });
    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        update();
        searchInput.focus();
    });
    document.getElementById('show-all').addEventListener('click', () => {
        searchInput.value = '';
        document.querySelector(`input[name="topic"][value="${ALL_TOPICS}"]`).checked = true;
        filter.topic = ALL_TOPICS;
        update();
        searchInput.focus();
    });
}

// ==========================================================================
// Reading sheet (post.html)
// ==========================================================================

class NoteFetchError extends Error {}

function setMeta(id, attribute, value) {
    document.getElementById(id).setAttribute(attribute, value);
}

function applySeo(note) {
    const url = `${SITE_URL}${postHref(note.slug)}`;
    document.title = `${note.title}, a note by Sarvesh Ganesan`;
    setMeta('meta-description', 'content', note.excerpt);
    setMeta('meta-keywords', 'content', note.tags.join(', '));
    setMeta('canonical-url', 'href', url);
    setMeta('og-url', 'content', url);
    setMeta('og-title', 'content', note.title);
    setMeta('og-description', 'content', note.excerpt);
    setMeta('article-published', 'content', new Date(`${note.date}T00:00:00Z`).toISOString());
    setMeta('twitter-title', 'content', note.title);
    setMeta('twitter-description', 'content', note.excerpt);
}

async function fetchMarkdown(slug) {
    let response;
    try {
        response = await fetch(`posts/${encodeURIComponent(slug)}.md`);
    } catch (cause) {
        throw new NoteFetchError('The request failed before the server answered. Check your connection and try again.', { cause });
    }
    if (!response.ok) {
        throw new NoteFetchError(`The server answered ${response.status} for posts/${slug}.md. Try again in a moment, or pick another note from the register.`);
    }
    return response.text();
}

/** The body of a post: without front matter and without the leading title, which the sheet header shows. */
function postBody(markdown) {
    return markdown
        .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
        .replace(/^\s*#\s+[^\n]*\n/, '');
}

function readingMinutes(markdown) {
    const words = markdown.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function headingId(text, taken) {
    const base = `s-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section'}`;
    let id = base;
    for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
    taken.add(id);
    return id;
}

function sheetHeader(note, minutes) {
    return `<header class="post-head">
        <h1>${escapeHtml(note.title)}</h1>
        <dl class="mini-tb" aria-label="Note details">
            <div><dt>Note</dt><dd>${note.number}</dd></div>
            <div><dt>Issued</dt><dd><time datetime="${note.date}">${formatDate(note.date)}</time></dd></div>
            <div><dt>Reading time</dt><dd>${minutes} min</dd></div>
            <div><dt>Topics</dt><dd>${escapeHtml(note.tags.join(', '))}</dd></div>
        </dl>
    </header>
    <p class="standfirst">${escapeHtml(note.excerpt)}</p>`;
}

function pagerLinks(newer, older) {
    const link = (note, label, className) => note
        ? `<a class="${className}" href="${postHref(note.slug)}"><span>${label}, ${note.number}</span><b>${escapeHtml(note.title)}</b></a>`
        : '';
    return `<nav class="pager" aria-label="More notes">
        ${link(newer, 'Newer note', 'newer')}${link(older, 'Older note', 'older')}
    </nav>
    <p class="back"><a href="./">Back to the notes register</a></p>`;
}

function keyPlanList(headings) {
    const items = headings.map((heading) => {
        const isSub = heading.tagName === 'H3';
        return `<li${isSub ? ' class="sub"' : ''}><a href="#${heading.id}">${escapeHtml(heading.textContent)}</a></li>`;
    }).join('');
    const isWide = window.matchMedia(WIDE_SHEET_QUERY).matches;
    return `<details class="keyplan"${isWide ? ' open' : ''}>
        <summary class="keyplan-title">Key plan <small>${headings.length} sections</small></summary>
        <nav aria-label="Sections of this note"><ol>${items}</ol></nav>
    </details>`;
}

/** Marks the section being read in the key plan, so the margin says "you are here". */
function trackCurrentSection(headings, keyPlan) {
    const links = new Map([...keyPlan.querySelectorAll('a')].map((a) => [a.getAttribute('href').slice(1), a]));
    let marked = null;
    let isQueued = false;
    const mark = () => {
        isQueued = false;
        const passed = headings.filter((h) => h.getBoundingClientRect().top <= SECTION_TRACK_OFFSET_PX);
        const link = passed.length ? links.get(passed[passed.length - 1].id) : null;
        if (link === marked) return;
        marked?.removeAttribute('aria-current');
        link?.setAttribute('aria-current', 'location');
        marked = link;
    };
    window.addEventListener('scroll', () => {
        if (!isQueued) { isQueued = true; requestAnimationFrame(mark); }
    }, { passive: true });
    mark();
}

function wrapTables(prose) {
    prose.querySelectorAll('table').forEach((table) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'table-scroll';
        wrapper.tabIndex = 0;
        wrapper.setAttribute('role', 'region');
        wrapper.setAttribute('aria-label', 'Table, scrolls sideways');
        table.replaceWith(wrapper);
        wrapper.append(table);
    });
}

async function mountFigures(prose) {
    const placeholders = [...prose.querySelectorAll('figure.js-figure[data-figure]')];
    await Promise.all(placeholders.map(async (figure) => {
        const name = figure.dataset.figure;
        figure.classList.add('figure');
        const modulePath = FIGURES[name];
        if (!modulePath) {
            figure.innerHTML = `<p class="fig-error">There is no figure called “${escapeHtml(name)}”. Add it to FIGURES in script.js.</p>`;
            return;
        }
        figure.innerHTML = '<p class="fig-loading">Drawing the figure.</p>';
        try {
            const { mountFigure } = await import(modulePath);
            mountFigure(figure);
        } catch (error) {
            console.error(`Figure "${name}" failed to mount`, error);
            figure.innerHTML = '<p class="fig-error">This figure could not be drawn. Reload the page to try again; the text around it explains the same idea.</p>';
        }
    }));
}

function renderNote(sheet, note, notes, markdown) {
    const index = notes.indexOf(note);
    const body = postBody(markdown);

    sheet.innerHTML = `<article>
        ${sheetHeader(note, readingMinutes(body))}
        <div class="post-body"><div class="prose" id="prose"></div></div>
        ${pagerLinks(notes[index - 1], notes[index + 1])}
    </article>`;

    const prose = sheet.querySelector('#prose');
    prose.innerHTML = marked.parse(body);
    wrapTables(prose);
    window.Prism?.highlightAllUnder(prose);

    const taken = new Set();
    const headings = [...prose.querySelectorAll('h2, h3')];
    headings.forEach((heading) => { heading.id = headingId(heading.textContent, taken); });
    if (headings.length >= 2) {
        prose.insertAdjacentHTML('beforebegin', keyPlanList(headings));
        trackCurrentSection(headings, sheet.querySelector('.keyplan'));
    }
    return mountFigures(prose);
}

function renderSheetError(sheet, { title, detail, onRetry }) {
    document.title = `${title}, notes by Sarvesh Ganesan`;
    sheet.innerHTML = `<div class="sheet-state">
        <h2></h2><p></p>
        <div class="actions">
            ${onRetry ? '<button type="button" class="paper-btn" id="retry">Try again</button>' : ''}
            <a href="./">Open the notes register</a>
        </div>
    </div>`;
    sheet.querySelector('h2').textContent = title;
    sheet.querySelector('p').textContent = detail;
    sheet.querySelector('#retry')?.addEventListener('click', onRetry);
}

function renderLoading(sheet) {
    sheet.innerHTML = `<div class="sheet-state">
        <h2>Opening the note</h2><p>Fetching the reading sheet.</p>
        <div class="loading-rule" aria-hidden="true"></div>
    </div>`;
}

async function initReadingSheet() {
    const sheet = document.getElementById('sheet');
    const slug = new URLSearchParams(window.location.search).get('slug');
    const notes = numberedNotes();
    const note = notes.find((candidate) => candidate.slug === slug);

    if (!slug) {
        renderSheetError(sheet, { title: 'No note named', detail: 'This link does not say which note to open. Pick one from the notes register.' });
        sheet.setAttribute('aria-busy', 'false');
        return;
    }
    if (!note) {
        renderSheetError(sheet, { title: 'Note not found', detail: `There is no note called “${slug}”. It may have been renamed; the notes register lists every note.` });
        sheet.setAttribute('aria-busy', 'false');
        return;
    }

    applySeo(note);
    const load = async () => {
        renderLoading(sheet);
        sheet.setAttribute('aria-busy', 'true');
        try {
            const markdown = await fetchMarkdown(note.slug);
            await renderNote(sheet, note, notes, markdown);
            if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
        } catch (error) {
            if (!(error instanceof NoteFetchError)) throw error;
            renderSheetError(sheet, {
                title: 'This note could not be loaded',
                detail: error.message,
                onRetry: load
            });
        } finally {
            sheet.setAttribute('aria-busy', 'false');
        }
    };
    await load();
}

if (document.body.classList.contains('post-page')) {
    initReadingSheet();
} else {
    initRegister();
}
