// Centered project dropdown — used on the homepage, /v1-1/, /how-to/, and
// every future project page. Edit the PROJECTS array to add a new entry.
//
// The component auto-detects which page it's on by comparing
// window.location.pathname to each entry's href, so it shows the right
// "selected" label per page with zero per-page wiring. On the homepage
// itself (no project href matches), the trigger reads "Projects".
//
// SECURITY: no innerHTML — DOM built via createElement + textContent only.

(function () {
  'use strict';

  // Single source of truth. Append entries here to add a project to the dropdown.
  const PROJECTS = [
    { label: 'How to take it to 11', href: '/how-to/' },
    { label: 'Visualizer V1.1', href: '/v1-1/' },
    { label: 'Original Visualizer', href: '/digable-planets/' },
  ];
  const HOMEPAGE_LABEL = 'Projects';

  function currentProject() {
    const path = window.location.pathname;
    // Match by href prefix so /how-to/, /how-to, and /how-to/index.html all
    // resolve to the same entry.
    return PROJECTS.find((p) => {
      const base = p.href.replace(/\/$/, '');
      return path === p.href || path === base || path.startsWith(base + '/');
    }) || null;
  }

  function init(host) {
    const root = document.createElement('div');
    root.className = 'nav-dropdown';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'nav-dropdown-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const label = document.createElement('span');
    label.className = 'nav-dropdown-label';
    const current = currentProject();
    label.textContent = current ? current.label : HOMEPAGE_LABEL;
    trigger.appendChild(label);

    const chevron = document.createElement('span');
    chevron.className = 'nav-dropdown-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '▾'; // ▾
    trigger.appendChild(chevron);

    const panel = document.createElement('ul');
    panel.className = 'nav-dropdown-panel';
    panel.setAttribute('role', 'listbox');
    panel.hidden = true;

    const optionEls = [];
    PROJECTS.forEach((p, idx) => {
      const li = document.createElement('li');
      li.className = 'nav-dropdown-option';
      li.setAttribute('role', 'option');
      if (current && current.href === p.href) li.classList.add('current');

      const a = document.createElement('a');
      a.className = 'nav-dropdown-link';
      a.href = p.href;
      a.textContent = p.label;
      // Arrow-nav focus management
      a.tabIndex = -1;
      a.dataset.idx = String(idx);

      li.appendChild(a);
      panel.appendChild(li);
      optionEls.push(a);
    });

    root.appendChild(trigger);
    root.appendChild(panel);
    host.appendChild(root);

    let open = false;
    let focusIdx = 0;

    function setOpen(next) {
      open = !!next;
      panel.hidden = !open;
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      root.classList.toggle('open', open);
      if (open) {
        // Focus the current entry if there is one, otherwise the first option.
        const startIdx = Math.max(0, PROJECTS.findIndex((p) => current && p.href === current.href));
        focusIdx = startIdx === -1 ? 0 : startIdx;
        try { optionEls[focusIdx].focus(); } catch (_) {}
      }
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(!open);
    });

    panel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusIdx = (focusIdx + 1) % optionEls.length;
        optionEls[focusIdx].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusIdx = (focusIdx - 1 + optionEls.length) % optionEls.length;
        optionEls[focusIdx].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        focusIdx = 0;
        optionEls[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        focusIdx = optionEls.length - 1;
        optionEls[focusIdx].focus();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        try { trigger.focus(); } catch (_) {}
      }
    });

    document.addEventListener('click', (e) => {
      if (!open) return;
      if (root.contains(e.target)) return;
      setOpen(false);
    });
  }

  function boot() {
    const host = document.querySelector('.nav-host');
    if (!host) return;
    init(host);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
