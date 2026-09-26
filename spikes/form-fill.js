// Throwaway browser probe: fill the Airtable grant form by label text.
// Element refs shift on every React re-render, which silently misaligns answers
// into the wrong questions. Anchoring on the label is the only stable handle.
(function () {
  function setNative(el, value) {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setRich(el, value) {
    el.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('insertText', false, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function controlFor(label) {
    const labels = [...document.querySelectorAll('div,label,span,h3,p')].filter(
      (n) => n.children.length === 0 && n.textContent.trim() === label,
    );
    for (const lab of labels) {
      let node = lab;
      for (let up = 0; up < 7 && node; up++) {
        node = node.parentElement;
        if (!node) break;
        const ctl = node.querySelector(
          'textarea, input[type=text], input:not([type]), [contenteditable="true"]',
        );
        if (ctl) return ctl;
      }
    }
    return null;
  }

  window.__fill = function (label, value) {
    const el = controlFor(label);
    if (!el) return 'NOFIELD | ' + label;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') setNative(el, value);
    else setRich(el, value);
    const got = (el.value !== undefined ? el.value : el.textContent) || '';
    return (got.trim().slice(0, 20) === value.trim().slice(0, 20) ? 'OK | ' : 'MISMATCH | ') + label;
  };

  window.__read = function (label) {
    const el = controlFor(label);
    if (!el) return 'NOFIELD';
    return ((el.value !== undefined ? el.value : el.textContent) || '').slice(0, 70);
  };

  return 'ready';
})();
