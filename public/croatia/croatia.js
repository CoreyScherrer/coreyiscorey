/* Croatia family hub — shared header, identity, and checklist state.
   SECURITY: no innerHTML. Every node is built with createElement +
   textContent, matching /nav.js, because family names are rendered from JSON.

   Per-person visibility is a UI filter, NOT a security boundary: roster.json
   is a single file, so anyone signed in could read it directly. That is an
   accepted trade-off for a family site behind Cloudflare Access. Nothing
   here is treated as authorization.  */
(function (global) {
  'use strict';

  var TEAM = 'teamkiki';           // teamkiki.cloudflareaccess.com
  var STORE = 'croatia.checks.v1'; // localStorage key prefix

  var PAGES = [
    { href: '/croatia/',                    label: 'Hub' },
    { href: '/croatia/considerations.html', label: 'The Process' },
    { href: '/croatia/people.html',         label: 'Applicants' },
    { href: '/croatia/tree.html',           label: 'Family Tree' }
  ];

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function chevron() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'chev');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M7.5 4.5 13 10l-5.5 5.5');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.8');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
    return svg;
  }

  /* ---------- header ---------- */
  function header() {
    var path = location.pathname.replace(/index\.html$/, '');
    var hdr = el('header', 'site-header');
    var bar = el('div', 'bar');

    var brand = el('a', 'brand');
    brand.href = '/croatia/';
    brand.appendChild(document.createTextNode('Croatian Citizenship '));
    brand.appendChild(el('span', null, '· Family Hub'));
    bar.appendChild(brand);

    var nav = el('nav', 'site-nav');
    nav.setAttribute('aria-label', 'Sections');
    PAGES.forEach(function (p) {
      var a = el('a', null, p.label);
      a.href = p.href;
      var here = p.href.replace(/index\.html$/, '');
      if (path === here || (here !== '/croatia/' && path.indexOf(here) === 0)) {
        a.setAttribute('aria-current', 'page');
      }
      nav.appendChild(a);
    });
    bar.appendChild(nav);
    hdr.appendChild(bar);

    var strip = el('div', 'whoami');
    strip.id = 'whoami';
    var inner = el('div', 'inner');
    inner.appendChild(el('span', 'dot'));
    inner.appendChild(el('span', null, 'Checking sign-in…'));
    strip.appendChild(inner);
    hdr.appendChild(strip);

    document.body.insertBefore(hdr, document.body.firstChild);
  }

  /* ---------- identity ---------- */
  function sha16(s) {
    var bytes = new TextEncoder().encode(String(s).trim().toLowerCase());
    return crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      return [].map.call(new Uint8Array(buf), function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('').slice(0, 16);
    });
  }

  function whoami() {
    return fetch('https://' + TEAM + '.cloudflareaccess.com/cdn-cgi/access/get-identity',
                 { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function renderWho(me, roster) {
    var strip = document.getElementById('whoami');
    if (!strip) return;
    var inner = strip.querySelector('.inner');
    clear(inner);
    inner.appendChild(el('span', 'dot'));

    if (!me || !me.email) {
      inner.appendChild(el('span', null,
        'Not signed in — showing everything, and changes are saved only on this device.'));
      return;
    }
    var t = el('span');
    t.appendChild(document.createTextNode('Signed in as '));
    t.appendChild(el('b', null, me.email));
    inner.appendChild(t);

    inner.appendChild(el('span', 'pill ' + (me.keeper ? 'keeper' : 'member'),
      me.keeper ? 'Record keeper — sees everyone' : 'Family member'));
    if (me.keeper) strip.classList.add('is-keeper');

    if (!me.keeper && me.person) {
      inner.appendChild(el('span', null, 'Showing your checklist.'));
    } else if (!me.keeper && !me.person) {
      inner.appendChild(el('span', null,
        'No applicant record is linked to this address yet — ask a record keeper.'));
    }
  }

  /* ---------- checklist state (per person, per browser) ---------- */
  function stateKey(me) {
    return STORE + ':' + ((me && me.email) ? me.email.toLowerCase() : 'anon');
  }

  function loadState(me) {
    try { return JSON.parse(localStorage.getItem(stateKey(me)) || '{}'); }
    catch (e) { return {}; }
  }

  function saveState(me, st) {
    try { localStorage.setItem(stateKey(me), JSON.stringify(st)); }
    catch (e) { /* private mode — checkboxes still work for the session */ }
  }

  /* ---------- accordion ---------- */
  function accordion(opts) {
    // opts: { title, subtitle, open, countText, body(node) }
    var wrap = el('section', 'acc');
    var btn = el('button', 'acc-head');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', opts.open ? 'true' : 'false');

    var h = el('h2', 'acc-title');
    h.appendChild(document.createTextNode(opts.title));
    if (opts.subtitle) h.appendChild(el('span', 'acc-sub', opts.subtitle));
    btn.appendChild(h);

    if (opts.countNode) btn.appendChild(opts.countNode);
    btn.appendChild(chevron());

    var body = el('div', 'acc-body');
    body.hidden = !opts.open;
    if (opts.open) wrap.classList.add('open');

    btn.addEventListener('click', function () {
      var nowOpen = body.hidden;
      body.hidden = !nowOpen;
      wrap.classList.toggle('open', nowOpen);
      btn.setAttribute('aria-expanded', String(nowOpen));
    });

    wrap.appendChild(btn);
    wrap.appendChild(body);
    return { root: wrap, body: body, head: btn };
  }

  /* ---------- boot ---------- */
  function boot(onReady) {
    header();
    var rosterP = fetch('/croatia/roster.json').then(function (r) { return r.json(); });
    Promise.all([rosterP, whoami()]).then(function (res) {
      var roster = res[0], ident = res[1];
      var me = null;
      if (!ident || !ident.email) {
        renderWho(null, roster);
        onReady(null, roster);
        return;
      }
      return sha16(ident.email).then(function (h) {
        var keeper = (roster.keeper_email_hashes || []).indexOf(h) !== -1;
        var person = null;
        (roster.people || []).forEach(function (p) {
          if (p.email_hash === h) person = p;
        });
        me = { email: ident.email, hash: h, keeper: keeper, person: person };
        renderWho(me, roster);
        onReady(me, roster);
      });
    }).catch(function (err) {
      renderWho(null, null);
      onReady(null, null, err);
    });
  }

  global.Croatia = {
    el: el, clear: clear, boot: boot, accordion: accordion,
    loadState: loadState, saveState: saveState, chevron: chevron
  };
})(window);
