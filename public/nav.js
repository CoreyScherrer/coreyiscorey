// Centered nav dropdowns — used on the homepage, /v1-1/, /how-to/, /calendar/,
// and every future project page. Two dropdowns render side by side: a
// "Visualizer" group and a "Community Calendar" group. Edit the GROUPS array
// below to add entries.
//
// Each dropdown auto-detects whether the current page belongs to its group by
// comparing window.location.pathname to each entry's href, so the matching
// dropdown shows the active label/highlight per page with zero per-page wiring.
//
// SECURITY: no innerHTML — DOM built via createElement + textContent only.

(function () {
  'use strict';

  // Source of truth. Each group becomes one dropdown.
  const GROUPS = [
    {
      label: 'Visualizer',
      items: [
        { label: 'How to take it to 11', href: '/how-to/' },
        { label: 'Visualizer V1.1', href: '/v1-1/' },
        { label: 'Original Visualizer', href: '/digable-planets/' },
      ],
    },
    {
      label: 'Community Calendar',
      items: [
        { label: 'List view', href: '/calendar/' },
        { label: 'Month view', href: '/calendar/?view=month' },
      ],
    },
  ];

  function pathMatches(href) {
    const path = window.location.pathname;
    const base = href.replace(/\?.*$/, '').replace(/\/$/, '');
    return path === href || path === base || path.startsWith(base + '/');
  }

  // The active item within a group (first whose href path matches), or null.
  function currentItem(group) {
    return group.items.find((it) => pathMatches(it.href)) || null;
  }

  function buildDropdown(group) {
    const current = currentItem(group);

    const root = document.createElement('div');
    root.className = 'nav-dropdown';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'nav-dropdown-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const label = document.createElement('span');
    label.className = 'nav-dropdown-label';
    // Trigger always reads the group name (e.g. "Visualizer"); the active item
    // is highlighted inside the panel.
    label.textContent = group.label;
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
    group.items.forEach((it, idx) => {
      const li = document.createElement('li');
      li.className = 'nav-dropdown-option';
      li.setAttribute('role', 'option');
      if (current && current.href === it.href) li.classList.add('current');

      const a = document.createElement('a');
      a.className = 'nav-dropdown-link';
      a.href = it.href;
      a.textContent = it.label;
      a.tabIndex = -1;
      a.dataset.idx = String(idx);

      li.appendChild(a);
      panel.appendChild(li);
      optionEls.push(a);
    });

    root.appendChild(trigger);
    root.appendChild(panel);
    if (current) root.classList.add('has-current');

    let open = false;
    let focusIdx = 0;

    function setOpen(next) {
      open = !!next;
      panel.hidden = !open;
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      root.classList.toggle('open', open);
      if (open) {
        const startIdx = group.items.findIndex((it) => current && it.href === current.href);
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

    return root;
  }

  function boot() {
    const host = document.querySelector('.nav-host');
    if (!host) return;
    GROUPS.forEach((group) => host.appendChild(buildDropdown(group)));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
