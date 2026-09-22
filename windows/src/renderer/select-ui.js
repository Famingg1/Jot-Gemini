// Replaces every native <select> in the main window with a styled trigger and a floating list.
// The <select> stays in the DOM (hidden) as the source of truth: `select.value = x`, `onchange`
// and option changes keep working exactly as before, so no caller had to change.
(function() {
  'use strict';
  const proto = HTMLSelectElement.prototype;
  const valueDescriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  const indexDescriptor = Object.getOwnPropertyDescriptor(proto, 'selectedIndex');
  const chevron = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
  const enhanced = new WeakSet();
  let openMenu = null;

  function labelFor(select) {
    const own = select.getAttribute('aria-label');
    if (own) return own;
    const group = select.closest('.settings-group');
    const heading = group?.querySelector('h2, h3');
    if (heading) return heading.textContent.trim();
    const label = select.closest('label');
    return label ? label.textContent.trim() : 'Keuze';
  }

  function enhance(select) {
    if (enhanced.has(select) || select.hasAttribute('data-native')) return;
    enhanced.add(select);
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `<span class="select-value"></span>${chevron}`;
    const valueBox = trigger.firstElementChild;
    const menu = document.createElement('div');
    menu.className = 'select-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('popover', 'manual');
    select.classList.add('select-native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    select.after(trigger);
    let active = -1;

    const refresh = () => {
      const option = select.selectedOptions[0];
      valueBox.textContent = option ? option.text : '';
      trigger.disabled = select.disabled;
      trigger.setAttribute('aria-label', labelFor(select));
      if (menu.isConnected && menu.matches(':popover-open')) build();
    };
    const choose = index => {
      const option = select.options[index];
      if (!option || option.disabled) return;
      close();
      if (select.selectedIndex === index) return;
      indexDescriptor.set.call(select, index);
      refresh();
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const setActive = index => {
      const items = menu.children;
      if (!items.length) return;
      active = Math.max(0, Math.min(items.length - 1, index));
      for (let i = 0; i < items.length; i++) items[i].classList.toggle('is-active', i === active);
      items[active].scrollIntoView({ block: 'nearest' });
      menu.setAttribute('aria-activedescendant', items[active].id);
    };
    const build = () => {
      menu.replaceChildren();
      [...select.options].forEach((option, index) => {
        const item = document.createElement('div');
        item.className = 'select-option';
        item.id = `${select.id || 'select'}-option-${index}`;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(option.selected));
        if (option.disabled) item.setAttribute('aria-disabled', 'true');
        const text = document.createElement('span');
        text.textContent = option.text;
        item.append(text);
        if (option.selected) { const mark = document.createElement('span'); mark.className = 'select-check'; mark.innerHTML = check; item.append(mark); }
        item.addEventListener('pointermove', () => setActive(index));
        item.addEventListener('click', () => choose(index));
        menu.append(item);
      });
    };
    const place = () => {
      const rect = trigger.getBoundingClientRect();
      // At least as wide as the trigger, wider when an option needs it.
      menu.style.minWidth = `${Math.max(rect.width, 180)}px`;
      const width = menu.offsetWidth;
      menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
      const height = menu.offsetHeight;
      const below = rect.bottom + 6;
      const fits = below + height <= window.innerHeight - 8;
      menu.style.top = `${fits ? below : Math.max(8, rect.top - 6 - height)}px`;
      menu.classList.toggle('opens-up', !fits);
    };
    const open = () => {
      if (select.disabled) return;
      if (openMenu && openMenu !== close) openMenu();
      build();
      if (!menu.isConnected) document.body.append(menu);
      menu.showPopover();
      place();
      setActive(Math.max(0, select.selectedIndex));
      trigger.setAttribute('aria-expanded', 'true');
      trigger.classList.add('is-open');
      openMenu = close;
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('scroll', close, true);
      window.addEventListener('resize', close);
      window.addEventListener('blur', close);
      document.addEventListener('close', close, true);
    };
    function close() {
      if (openMenu !== close) return;
      openMenu = null;
      if (menu.matches(':popover-open')) menu.hidePopover();
      trigger.setAttribute('aria-expanded', 'false');
      trigger.classList.remove('is-open');
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      document.removeEventListener('close', close, true);
    }
    function outside(event) { if (!menu.contains(event.target) && !trigger.contains(event.target)) close(); }
    const isOpen = () => openMenu === close;
    let typed = '', typedAt = 0;
    trigger.addEventListener('click', () => isOpen() ? close() : open());
    trigger.addEventListener('keydown', event => {
      const options = select.options;
      if (event.key === 'Escape') { if (isOpen()) { event.preventDefault(); event.stopPropagation(); close(); } return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        if (isOpen()) setActive(active + step);
        else choose(Math.max(0, Math.min(options.length - 1, select.selectedIndex + step)));
        return;
      }
      if (event.key === 'Home' || event.key === 'End') { if (isOpen()) { event.preventDefault(); setActive(event.key === 'Home' ? 0 : options.length - 1); } return; }
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (isOpen()) choose(active); else open(); return; }
      if (event.key === 'Tab') { close(); return; }
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        const now = Date.now();
        typed = now - typedAt < 700 ? typed + event.key.toLowerCase() : event.key.toLowerCase();
        typedAt = now;
        const start = isOpen() ? active : select.selectedIndex;
        for (let n = 1; n <= options.length; n++) {
          const index = (start + n) % options.length;
          if (options[index].text.toLowerCase().startsWith(typed)) { if (isOpen()) setActive(index); else choose(index); break; }
        }
      }
    });
    for (const [name, descriptor] of [['value', valueDescriptor], ['selectedIndex', indexDescriptor]]) {
      Object.defineProperty(select, name, {
        configurable: true,
        get() { return descriptor.get.call(this); },
        set(next) { descriptor.set.call(this, next); refresh(); }
      });
    }
    select.addEventListener('change', refresh);
    new MutationObserver(refresh).observe(select, { childList: true, subtree: true, attributes: true, characterData: true });
    refresh();
  }

  const scan = root => { if (root.matches?.('select')) enhance(root); root.querySelectorAll?.('select').forEach(enhance); };
  scan(document);
  new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) scan(node); }).observe(document.body, { childList: true, subtree: true });
})();
