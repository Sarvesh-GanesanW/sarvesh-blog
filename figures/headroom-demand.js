/**
 * Figure: declared demand and headroom in one node pool (headroom-scaler post).
 *
 * A simplified model of the planner's packing: every item is one pod slot of
 * the same shape, so first-fit decreasing reduces to filling the most loaded
 * Ready nodes first and then opening new nodes up to the pool maximum.
 */

const SLOTS_PER_NODE = 4;
const READY_NODES_USED = [3, 2, 1]; // running pods on each Ready node
const HEADROOM_SLOTS = 3;
const POOL_MAX = 7;
const DEMAND_MAX = 16;
const DEMAND_START = 6;
const ARRIVAL_STAGGER_MS = 40;
const COMPACT_BELOW_PX = 560;
const SVG_NS = 'http://www.w3.org/2000/svg';

// Two drawing scales so the lettering stays readable on a phone.
const LAYOUTS = {
    wide: { nodeW: 70, gap: 22, slotH: 42, left: 20, baseY: 290, width: 760, height: 330, font: 15, label: (i) => `node ${i}` },
    compact: { nodeW: 38, gap: 8, slotH: 30, left: 6, baseY: 226, width: 392, height: 256, font: 16, label: (i) => String(i) }
};

let figureCount = 0;

function readyNodes() {
    return READY_NODES_USED.map((used) => ({ used, items: [], isNew: false }));
}

function firstWithRoom(nodes) {
    return nodes.find((node) => node.used + node.items.length < SLOTS_PER_NODE);
}

/** headroom-scaler: demand first, then headroom, onto existing room, then new nodes. */
function planAhead(demand) {
    const nodes = readyNodes();
    const items = [...Array(demand).fill('demand'), ...Array(HEADROOM_SLOTS).fill('head')];
    let unplaced = 0;
    items.forEach((kind) => {
        let bin = firstWithRoom(nodes);
        if (!bin && nodes.length < POOL_MAX) {
            bin = { used: 0, items: [], isNew: true };
            nodes.push(bin);
        }
        if (bin) bin.items.push(kind); else unplaced += 1;
    });
    return { nodes, unplaced, pending: 0, booting: 0 };
}

/** A reactive scaler: nothing happens until pods are already Pending. */
function planReactive(demand, isWindowOpen) {
    const nodes = readyNodes();
    if (!isWindowOpen) return { nodes, unplaced: 0, pending: 0, booting: 0 };
    let pending = 0;
    for (let i = 0; i < demand; i += 1) {
        const bin = firstWithRoom(nodes);
        if (bin) bin.items.push('demand'); else pending += 1;
    }
    const booting = Math.min(Math.ceil(pending / SLOTS_PER_NODE), POOL_MAX - nodes.length);
    for (let b = 0; b < booting; b += 1) nodes.push({ used: 0, items: [], isNew: true, isBooting: true });
    return { nodes, unplaced: 0, pending, booting };
}

function plural(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function describe(plan, state) {
    const added = plan.nodes.filter((node) => node.isNew && !node.isBooting).length;
    if (state.mode === 'react') {
        if (!state.isWindowOpen) return { added: 0, wait: 0, text: 'Reactive: nothing happens yet. No pod is pending, so no node is requested.' };
        return {
            added: 0,
            wait: plan.pending,
            text: plan.pending
                ? `${plural(plan.pending, 'pod')} ${plan.pending === 1 ? 'is' : 'are'} Pending. ${plural(plan.booting, 'node')} ${plan.booting === 1 ? 'is' : 'are'} requested only now, and the pods wait while they boot.`
                : `All ${plural(state.demand, 'pod')} fit on the free room of the Ready nodes.`
        };
    }
    const capped = plan.unplaced
        ? ` The pool maximum is reached, so ${plural(plan.unplaced, 'headroom slot')} ${plan.unplaced === 1 ? 'is' : 'are'} left out; demand is packed first.`
        : '';
    if (!state.isWindowOpen) {
        return { added, wait: 0, text: `${plural(added, 'new node')} planned for ${state.demand} declared pods plus ${HEADROOM_SLOTS} headroom slots.${capped}` };
    }
    return { added, wait: 0, text: `The window opens and all ${plural(state.demand, 'pod')} land on nodes that already had room.${capped}` };
}

function figureMarkup(uid) {
    return `
    <div class="fig-controls">
        <div class="slider">
            <label class="slider-label" for="${uid}-demand">Declared demand</label>
            <input type="range" id="${uid}-demand" min="0" max="${DEMAND_MAX}" step="1" value="${DEMAND_START}" aria-describedby="${uid}-unit">
            <output for="${uid}-demand" id="${uid}-demand-out">${DEMAND_START}</output>
            <span class="unit" id="${uid}-unit">pods</span>
        </div>
        <fieldset class="mode">
            <legend class="visually-hidden">Autoscaler</legend>
            <input type="radio" name="${uid}-mode" id="${uid}-ahead" value="ahead" checked><label for="${uid}-ahead">headroom-scaler</label>
            <input type="radio" name="${uid}-mode" id="${uid}-react" value="react"><label for="${uid}-react">Reactive</label>
        </fieldset>
        <button type="button" class="paper-btn" id="${uid}-run" aria-pressed="false">Open the window</button>
    </div>
    <div class="fig-draw">
        <svg viewBox="0 0 760 330" role="img" aria-labelledby="${uid}-status">
            <defs>
                <pattern id="${uid}-diag" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="pat-ground" width="7" height="7"/><line class="pat-line" x1="0" y1="0" x2="0" y2="7" stroke-width="1.2"/></pattern>
                <pattern id="${uid}-cross" width="8" height="8" patternUnits="userSpaceOnUse"><rect class="pat-ground" width="8" height="8"/><path class="pat-line" d="M0 0 L8 8 M8 0 L0 8" stroke-width="1"/></pattern>
                <marker id="${uid}-tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="11" markerHeight="11" orient="auto"><path class="pat-line" d="M2 8 L8 2" stroke-width="1.6"/></marker>
            </defs>
            <g class="fig-layer"></g>
        </svg>
    </div>
    <p class="fig-status" id="${uid}-status" aria-live="polite"></p>
    <div class="fig-read">
        <div><b class="read-added">0</b><span class="read-added-label">nodes added before the window</span></div>
        <div><b class="read-wait">0</b><span>pods waiting when the window opens</span></div>
    </div>
    <div class="fig-legend" aria-hidden="true">
        <span><svg viewBox="0 0 18 14"><rect x="1" y="1" width="16" height="12" fill="currentColor"/></svg>running pod</span>
        <span><svg viewBox="0 0 18 14"><rect x="1" y="1" width="16" height="12" fill="url(#${uid}-cross)" stroke="currentColor"/></svg>declared demand, held</span>
        <span><svg viewBox="0 0 18 14"><rect x="1" y="1" width="16" height="12" fill="url(#${uid}-diag)" stroke="currentColor"/></svg>headroom slot</span>
        <span><svg viewBox="0 0 18 14"><rect class="pat-ground" x="1" y="1" width="16" height="12" stroke="currentColor" stroke-dasharray="3 3"/></svg>pending pod</span>
    </div>
    <figcaption><b>Figure 1.</b> One pool, nodes of four pod slots, three Ready nodes, a headroom rule of ${HEADROOM_SLOTS} slots and a pool maximum of ${POOL_MAX} nodes. Move the declared demand, then open the window to let the pods arrive. Switch to Reactive to see the same pods wait for nodes instead. A simplified model of the packing order described above.</figcaption>`;
}

/** Replaces the placeholder's contents with the live figure. */
export function mountFigure(figure) {
    figureCount += 1;
    const uid = `fig-headroom-${figureCount}`;
    figure.innerHTML = figureMarkup(uid);
    figure.setAttribute('aria-label', 'Figure 1: declared demand and headroom in one node pool');

    const svg = figure.querySelector('svg');
    const layer = figure.querySelector('.fig-layer');
    const demandInput = figure.querySelector(`#${uid}-demand`);
    const demandOut = figure.querySelector(`#${uid}-demand-out`);
    const runButton = figure.querySelector(`#${uid}-run`);
    const status = figure.querySelector(`#${uid}-status`);
    const readAdded = figure.querySelector('.read-added');
    const readAddedLabel = figure.querySelector('.read-added-label');
    const readWait = figure.querySelector('.read-wait');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    svg.style.setProperty('--fig-diag', `url(#${uid}-diag)`);
    svg.style.setProperty('--fig-cross', `url(#${uid}-cross)`);

    const state = { demand: DEMAND_START, mode: 'ahead', isWindowOpen: false };
    let G = LAYOUTS.wide;
    const nodeH = () => SLOTS_PER_NODE * G.slotH + 10;
    const nodeX = (i) => G.left + i * (G.nodeW + G.gap);

    function draw(name, attrs, text) {
        const node = document.createElementNS(SVG_NS, name);
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
        if (text !== undefined) node.textContent = text;
        layer.appendChild(node);
        return node;
    }

    function slotRect(x, slotIndex, cls, delayMs) {
        const inset = G.nodeW > 50 ? 6 : 4;
        const y = G.baseY - 5 - (slotIndex + 1) * G.slotH;
        const rect = draw('rect', { x: x + inset, y: y + 3, width: G.nodeW - inset * 2, height: G.slotH - 6, class: cls });
        if (delayMs !== undefined) {
            rect.classList.add('drop');
            rect.style.setProperty('--delay', `${delayMs}ms`);
        }
    }

    function drawNodes(plan, animateArrivals) {
        let arrival = 0;
        plan.nodes.forEach((node, i) => {
            const x = nodeX(i);
            draw('rect', { x, y: G.baseY - nodeH(), width: G.nodeW, height: nodeH(), class: node.isNew ? 'ln dash' : 'ln' });
            const label = node.isNew ? (node.isBooting ? 'boot' : 'new') : G.label(i + 1);
            draw('text', { x: x + G.nodeW / 2, y: G.baseY + 20, 'text-anchor': 'middle' }, label);
            for (let s = 0; s < node.used; s += 1) slotRect(x, s, 'pod');
            node.items.forEach((kind, k) => {
                const slot = node.used + k;
                if (kind === 'head') { slotRect(x, slot, 'head'); return; }
                if (!state.isWindowOpen) { slotRect(x, slot, 'demand'); return; }
                const delay = animateArrivals && !motionQuery.matches ? (arrival++) * ARRIVAL_STAGGER_MS : undefined;
                slotRect(x, slot, 'pod', delay);
            });
        });
    }

    function drawPending(count) {
        if (!count) return;
        const x0 = nodeX(POOL_MAX) - G.gap + 8;
        const size = G.nodeW > 50 ? 20 : 16;
        const top = G.baseY - nodeH();
        draw('text', { x: x0, y: top - 8 }, 'Pending');
        for (let i = 0; i < count; i += 1) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            draw('rect', { x: x0 + col * (size + 5), y: top + row * (size + 5), width: size, height: size, class: 'pending' });
        }
    }

    function drawDimension(x1, x2, y, extendTo, label) {
        const tick = `url(#${uid}-tick)`;
        draw('line', { x1, y1: y, x2, y2: y, class: 'ln', 'marker-start': tick, 'marker-end': tick, style: 'stroke-width:1' });
        draw('line', { x1, y1: y - 6, x2: x1, y2: extendTo, class: 'ln', style: 'stroke-width:1;stroke-dasharray:2 3' });
        draw('line', { x1: x2, y1: y - 6, x2, y2: extendTo, class: 'ln', style: 'stroke-width:1;stroke-dasharray:2 3' });
        const mid = (x1 + x2) / 2;
        const anchor = mid > G.width * 0.72 ? 'end' : (mid < G.width * 0.22 ? 'start' : 'middle');
        const tx = anchor === 'end' ? x2 : (anchor === 'start' ? x1 : mid);
        draw('text', { x: tx, y: y - 9, 'text-anchor': anchor }, label);
    }

    function drawNewNodeDimension(plan) {
        const firstNew = plan.nodes.findIndex((node) => node.isNew);
        if (firstNew < 0) return;
        const x1 = nodeX(firstNew);
        const x2 = nodeX(plan.nodes.length - 1) + G.nodeW;
        const label = plan.booting ? 'requested after pods wait' : 'added before the pods exist';
        drawDimension(x1, x2, G.baseY - nodeH() - 18, G.baseY - nodeH(), label);
    }

    function drawPoolOutline(plan) {
        for (let i = plan.nodes.length; i < POOL_MAX; i += 1) {
            draw('rect', { x: nodeX(i), y: G.baseY - nodeH(), width: G.nodeW, height: nodeH(), class: 'ln', style: 'stroke-width:1;stroke-dasharray:1 4;opacity:.55' });
        }
        drawDimension(nodeX(0), nodeX(POOL_MAX - 1) + G.nodeW, 26, G.baseY - nodeH() - 34, `pool maximum, ${POOL_MAX} nodes`);
    }

    function render(animateArrivals) {
        layer.replaceChildren();
        const plan = state.mode === 'ahead' ? planAhead(state.demand) : planReactive(state.demand, state.isWindowOpen);
        G = figure.clientWidth < COMPACT_BELOW_PX ? LAYOUTS.compact : LAYOUTS.wide;
        svg.setAttribute('viewBox', `0 0 ${G.width} ${G.height}`);
        svg.style.fontSize = `${G.font}px`;
        draw('line', { x1: 2, y1: G.baseY, x2: G.width - 2, y2: G.baseY, class: 'ln', style: 'stroke-width:2' });
        drawPoolOutline(plan);
        drawNodes(plan, animateArrivals);
        drawNewNodeDimension(plan);
        drawPending(plan.pending);

        const summary = describe(plan, state);
        readAdded.textContent = summary.added;
        readAddedLabel.textContent = state.mode === 'ahead'
            ? 'nodes added before the window'
            : 'nodes added before the window (reactive adds none)';
        readWait.textContent = summary.wait;
        status.textContent = summary.text;
    }

    demandInput.addEventListener('input', () => {
        state.demand = Number(demandInput.value);
        demandOut.textContent = state.demand;
        render(false);
    });
    figure.querySelectorAll(`input[name="${uid}-mode"]`).forEach((radio) => {
        radio.addEventListener('change', () => { state.mode = radio.value; render(false); });
    });
    runButton.addEventListener('click', () => {
        state.isWindowOpen = !state.isWindowOpen;
        runButton.setAttribute('aria-pressed', String(state.isWindowOpen));
        runButton.textContent = state.isWindowOpen ? 'Reset to before the window' : 'Open the window';
        render(state.isWindowOpen);
    });

    let wasCompact = figure.clientWidth < COMPACT_BELOW_PX;
    new ResizeObserver(() => {
        const isCompact = figure.clientWidth < COMPACT_BELOW_PX;
        if (isCompact !== wasCompact) { wasCompact = isCompact; render(false); }
    }).observe(figure);

    render(false);
}
