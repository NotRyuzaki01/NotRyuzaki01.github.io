/** @param {string} value */
async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Clipboard permissions vary across browsers and embedded views.
  }

  const field = document.createElement('textarea');
  field.value = value;
  field.readOnly = true;
  field.setAttribute('aria-label', 'Text to copy');
  field.style.cssText = 'position:fixed;inset:0 auto auto 0;opacity:0;pointer-events:none;font-size:16px';
  const previousFocus = document.activeElement;
  document.body.append(field);
  field.focus({ preventScroll: true });
  field.select();
  field.setSelectionRange(0, field.value.length);
  try {
    return document.execCommand?.('copy') === true;
  } catch {
    return false;
  } finally {
    field.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
  }
}

/**
 * @param {HTMLButtonElement} button
 * @param {string} message
 * @param {string} [value]
 */
function showStatus(button, message, value) {
  const group = button.closest('[data-contact]') ?? document;
  const status = group.querySelector('[data-feedback]');
  if (!status) return;
  group.querySelector('[data-copy-recovery-label]')?.remove();
  status.textContent = message;
  if (!value) return;

  const label = document.createElement('label');
  label.className = 'contact-recovery';
  label.dataset.copyRecoveryLabel = '';
  label.textContent = 'Text to copy';
  const field = document.createElement('input');
  field.type = 'text';
  field.readOnly = true;
  field.value = value;
  field.dataset.copyRecovery = '';
  label.append(field);
  status.after(label);
  field.focus();
  field.select();
}

/**
 * @param {HTMLButtonElement} button
 * @param {string} value
 * @param {string} success
 */
async function copyAndReport(button, value, success) {
  if (await copyText(value)) {
    showStatus(button, success);
  } else {
    showStatus(button, 'Copy the text below to share it.', value);
  }
}

for (const button of document.querySelectorAll('button[data-copy]')) {
  if (!(button instanceof HTMLButtonElement)) continue;
  const value = button.dataset.copy;
  if (!value) continue;
  button.hidden = false;
  button.addEventListener('click', () => copyAndReport(button, value, 'Copied to clipboard.'));
}

for (const button of document.querySelectorAll('button[data-share]')) {
  if (!(button instanceof HTMLButtonElement)) continue;
  button.hidden = false;
  button.addEventListener('click', async () => {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/index\.html$/, '/');
    const profile = { title: 'Artem Kotliar · Digital Contact Card', url: url.href };
    showStatus(button, '');
    try {
      if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(profile))) {
        await navigator.share(profile);
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
    await copyAndReport(button, profile.url, 'Profile link copied.');
  });
}
