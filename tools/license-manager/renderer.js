'use strict';

const $ = (id) => document.getElementById(id);
const api = window.licenseManager;

function setBanner(state) {
  const b = $('banner');
  if (state.configured) {
    b.className = 'banner ok';
    b.innerHTML =
      `✓ Signing key: <code>${state.keyPath}</code> ` +
      `<button id="chooseKey" class="btn ghost" style="margin-left:auto">Change</button>`;
  } else {
    b.className = 'banner bad';
    b.innerHTML =
      `✗ No signing key selected${state.error ? ' (' + state.error + ')' : ''}. ` +
      `Pick your <code>private.pem</code>. ` +
      `<button id="chooseKey" class="btn ghost" style="margin-left:auto">Select private.pem</button>`;
  }
  $('chooseKey').addEventListener('click', async () => {
    const next = await api.chooseKey();
    setBanner(next);
    refreshIssued();
  });
}

async function refreshStatus() {
  setBanner(await api.keyStatus());
}

async function refreshIssued() {
  const rows = await api.list();
  const body = $('issuedBody');
  $('issuedCount').textContent = rows.length ? `· ${rows.length}` : '';
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="muted">No keys issued yet.</td></tr>';
    return;
  }
  body.innerHTML = rows
    .map(
      (r) =>
        `<tr><td>${r.serial}</td><td>${r.shop}</td><td>${r.expires}</td><td>${r.months}</td>` +
        `<td>${r.machine === 'ANYP' ? 'any' : r.machine}</td>` +
        `<td class="key" title="click to copy">${r.key}</td></tr>`
    )
    .join('');
  body.querySelectorAll('td.key').forEach((td) => {
    td.addEventListener('click', () => {
      navigator.clipboard.writeText(td.textContent.trim());
    });
  });
}

// month quick-chips
document.querySelectorAll('#monthChips .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#monthChips .chip').forEach((c) => c.classList.remove('on'));
    chip.classList.add('on');
    $('months').value = chip.dataset.m;
  });
});

$('issue').addEventListener('click', async () => {
  $('error').textContent = '';
  const shop = $('shop').value.trim();
  if (!shop) {
    $('error').textContent = 'Enter a shop name.';
    return;
  }
  $('issue').disabled = true;
  const res = await api.issue({
    shop,
    months: Number($('months').value) || 12,
    grace: Number($('grace').value) || 0,
    machine: $('machine').value.trim(),
    expires: $('expires').value || undefined,
  });
  $('issue').disabled = false;

  if (!res.ok) {
    $('error').textContent = res.error || 'Could not generate the key.';
    return;
  }
  $('result').style.display = 'block';
  $('resultMeta').textContent =
    `${res.shop} · serial ${res.serial} · expires ${res.expires} · ` +
    `${res.machine ? 'machine ' + res.machine.match(/.{4}/g).join('-') : 'any PC'} · saved to ${res.savedTo}`;
  $('keyOut').value = res.key;
  refreshIssued();
});

$('copy').addEventListener('click', () => {
  navigator.clipboard.writeText($('keyOut').value);
});

$('save').addEventListener('click', async () => {
  await api.saveKey($('keyOut').value);
});

refreshStatus();
refreshIssued();
