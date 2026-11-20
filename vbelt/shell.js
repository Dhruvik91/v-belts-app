/* ==========================================================================
   App shell — renders the sidebar + topbar on every page and owns the
   global keyboard shortcuts. Include right after <aside id="sidebar">.

   Page contract:
     <body data-page="inventory" data-title="Inventory">
       <aside class="sidebar" id="sidebar"></aside>
       <script src="shell.js"></script>
       <main class="main"> <div class="page">…</div> </main>
   ========================================================================== */

(function () {
    const P = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

    const ICONS = {
        user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5"/>',
        home: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
        box: '<path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z"/><path d="M4 7.5 12 11l8-3.5M12 11v9"/>',
        users: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3 2.8-4.7 5.5-4.7s4.9 1.7 5.5 4.7"/><path d="M15.5 5.8a3 3 0 0 1 0 5.4M17.5 14.6c1.6.6 2.7 2 3 4.4"/>',
        alert: '<path d="M12 4.5 20.5 19h-17z"/><path d="M12 10v4"/><circle cx="12" cy="16.6" r=".6" fill="currentColor"/>',
        belt: '<rect x="3.5" y="7" width="17" height="10" rx="5"/><path d="M8 7v10M12 7v10M16 7v10"/>',
        file: '<path d="M6.5 3.5h7l4.5 4.5v12a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z"/><path d="M13.5 3.5V8H18"/><path d="M9 12.5h6M9 16h4"/>',
        folder: '<path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
        bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
        help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.6a2.3 2.3 0 0 1 4.4.9c0 1.6-2.2 2-2.2 3.4"/><circle cx="12" cy="16.8" r=".6" fill="currentColor"/>',
        sidebar: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M9 5v14"/>',
        search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        minus: '<path d="M5 12h14"/>',
        edit: '<path d="M14.5 5.5 18.5 9.5 9 19H5v-4z"/><path d="m12.5 7.5 4 4"/>',
        trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7"/>',
        eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
        scissors: '<circle cx="6.5" cy="7" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/><path d="M8.6 8.4 19.5 18M8.6 15.6 19.5 6"/>',
        printer: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="1.5"/><path d="M7 14h10v6H7z"/>',
        download: '<path d="M12 4v11M7.5 11 12 15.5 16.5 11"/><path d="M5 19.5h14"/>',
        x: '<path d="M6 6l12 12M18 6 6 18"/>',
        check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
        tag: '<path d="M4 12.5V5a1 1 0 0 1 1-1h7.5l7.5 7.5-8.5 8.5z"/><circle cx="8.5" cy="8.5" r="1.3"/>',
        arrowIn: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/>',
        arrowOut: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/>',
        keyboard: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><path d="M7 10h.01M10 10h.01M13 10h.01M16 10h.01M8 14h8"/>',
        info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".6" fill="currentColor"/>',
        ruler: '<path d="M3.5 15.5 15.5 3.5l5 5-12 12z"/><path d="m7 12 2 2M10 9l2 2M13 6l2 2"/>'
    };

    window.icon = function (name, cls) {
        return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" ${P} aria-hidden="true">${ICONS[name] || ''}</svg>`;
    };

    const onProducts = /products\.html$/.test(location.pathname);

    const QUICK = [
        { key: 'addProduct', label: 'Add product', href: 'index.html#addProduct' },
        { key: 'addParty', label: 'Add party', href: 'index.html#addParty' },
        { key: 'bulkAdd', label: 'Bulk add stock', href: 'products.html#bulkAdd' },
        { key: 'bulkSub', label: 'Bulk subtract stock', href: 'products.html#bulkSub' }
    ];

    const PAGES = [
        { key: 'dashboard', label: 'Dashboard', icon: 'home', href: 'index.html' },
        { key: 'inventory', label: 'Inventory', icon: 'box', href: 'products.html#inventory' },
        { key: 'party', label: 'Party list', icon: 'users', href: 'party.html' },
        { key: 'lowStock', label: 'Low stock', icon: 'alert', href: 'low-stock.html' },
        { key: 'timingBelt', label: 'Timing belts', icon: 'belt', href: 'timing-belt.html' },
        { key: 'purchaseOrder', label: 'Purchase order', icon: 'file', href: 'purchase-order.html' }
    ];

    const TITLES = {
        dashboard: 'Dashboard', inventory: 'Inventory', bulkAdd: 'Bulk add stock', bulkSub: 'Bulk subtract stock',
        party: 'Party list', lowStock: 'Low stock', timingBelt: 'Timing belts', purchaseOrder: 'Purchase order'
    };

    function link(item, plain) {
        return `<a class="sb-link${plain ? ' sb-plain' : ''}" data-key="${item.key}" href="${item.href}">` +
            (plain ? '' : icon(item.icon)) + `<span>${item.label}</span></a>`;
    }

    function renderSidebar() {
        const sb = document.getElementById('sidebar');
        if (!sb) return;
        sb.innerHTML = `
            <div class="sb-top">
                <a class="sb-account" href="index.html">${icon('user')}<span>Patel V Belt Corp.</span></a>
            </div>
            <nav class="sb-scroll">
                <div class="sb-section">
                    ${QUICK.map(i => link(i, true)).join('')}
                </div>
                <div class="sb-section">
                    <div class="sb-label">Pages</div>
                    ${PAGES.map(i => link(i)).join('')}
                </div>
                <div class="sb-section">
                    <div class="sb-label">More</div>
                    <button class="sb-link" type="button" data-action="shortcuts">${icon('keyboard')}<span>Keyboard shortcuts</span></button>
                    <div id="sbStorage"></div>
                </div>
            </nav>
            <div class="sb-footer">
                <a class="sb-footer-link" href="index.html#addProduct">Add product</a>
                <div class="sb-footer-icons">
                    <a class="icon-btn" href="low-stock.html" title="Low stock">${icon('bell')}</a>
                    <a class="icon-btn" href="purchase-order.html" title="Purchase order">${icon('printer')}</a>
                    <button class="icon-btn" type="button" data-action="shortcuts" title="Keyboard shortcuts">${icon('help')}</button>
                </div>
            </div>`;

        sb.addEventListener('click', e => {
            const btn = e.target.closest('[data-action="shortcuts"]');
            if (btn) showShortcuts();
            // close the drawer after navigating on narrow windows
            if (e.target.closest('a')) document.body.classList.remove('sb-open');
        });

        const backdrop = document.createElement('div');
        backdrop.className = 'sb-backdrop';
        backdrop.addEventListener('click', () => document.body.classList.remove('sb-open'));
        sb.after(backdrop);

        try {
            if (localStorage.getItem('sbCollapsed') === '1') document.body.classList.add('sb-collapsed');
        } catch (e) { /* storage unavailable */ }
    }

    function currentKey() {
        if (onProducts) {
            const h = location.hash.replace('#', '');
            return h === 'bulkAdd' || h === 'bulkSub' ? h : 'inventory';
        }
        return document.body.dataset.page || '';
    }

    function setActive(key) {
        key = key || currentKey();
        document.querySelectorAll('.sidebar .sb-link[data-key]').forEach(a => {
            a.classList.toggle('active', a.dataset.key === key);
        });
        const cur = document.getElementById('crumbCurrent');
        if (cur) cur.textContent = TITLES[key] || document.body.dataset.title || '';
    }

    function toggleSidebar() {
        if (window.matchMedia('(max-width: 900px)').matches) {
            document.body.classList.toggle('sb-open');
            return;
        }
        const collapsed = document.body.classList.toggle('sb-collapsed');
        try { localStorage.setItem('sbCollapsed', collapsed ? '1' : '0'); } catch (e) { /* ignore */ }
    }

    function renderTopbar() {
        const main = document.querySelector('.main');
        if (!main || main.querySelector('.topbar')) return;
        const bar = document.createElement('header');
        bar.className = 'topbar no-print';
        bar.innerHTML = `
            <div class="pill-bar">
                <button class="icon-btn" type="button" id="sbToggle" title="Toggle sidebar">${icon('sidebar')}</button>
                <div class="crumbs">
                    <a href="index.html">V-Belt</a><span class="sep">/</span><span class="current" id="crumbCurrent"></span>
                </div>
            </div>
            <div class="pill-bar">
                <a class="icon-btn" href="index.html#addProduct" title="Add product">${icon('plus')}</a>
                <a class="icon-btn" href="low-stock.html" title="Low stock">${icon('bell')}</a>
                <a class="icon-btn" href="purchase-order.html" title="Purchase order">${icon('printer')}</a>
            </div>`;
        main.prepend(bar);
        bar.querySelector('#sbToggle').addEventListener('click', toggleSidebar);
        setActive();
    }

    function showShortcuts() {
        const msg = 'Ctrl+D Dashboard · Ctrl+I Inventory · Ctrl+A Bulk add · Ctrl+S Bulk subtract' +
            (onProducts ? ' · F2 Edit product · F3 Product details' : '');
        if (window.showToast) window.showToast(msg, 'info', 6000);
    }

    /* Global shortcuts — only the keys we own are intercepted, so Ctrl+C / Ctrl+V keep working */
    document.addEventListener('keydown', e => {
        if (!e.ctrlKey || e.altKey || e.metaKey) return;
        const routes = { d: 'index.html', i: 'products.html#inventory', a: 'products.html#bulkAdd', s: 'products.html#bulkSub' };
        const key = e.key.toLowerCase();
        if (!routes[key]) return;
        e.preventDefault();
        e.stopPropagation();
        const target = routes[key];
        if (onProducts && target.startsWith('products.html')) {
            location.hash = target.split('#')[1];
        } else {
            location.href = target;
        }
    }, true);

    window.addEventListener('hashchange', () => setActive());

    window.Shell = { setActive, toggleSidebar, showShortcuts };

    renderSidebar();
    setActive();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderTopbar);
    } else {
        renderTopbar();
    }
})();
