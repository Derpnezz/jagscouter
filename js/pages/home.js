window.FRC = window.FRC || {};
window.FRC.pages = window.FRC.pages || {};

window.FRC.pages.home = {
  render(root) {
    const a = (window.FRC.config && window.FRC.config.active) || {};
    const esc = (window.FRC.ui && window.FRC.ui.escape) || (s => String(s == null ? '' : s));
    const count = window.FRC.storage.getMatches().length;
    const season = [a.name, a.season].filter(Boolean).join(' ');
    root.innerHTML = `
      ${window.FRC.ui.header('Home')}
      <main class="home-page">
        <div class="home-intro">
          <h1>JagScouter</h1>
          <p>Offline FRC scouting from JagBots4638. Scout matches on your phone, hand the data to your manager with a QR code, then review it all in one place.</p>
          <div class="home-meta">Current season: ${esc(season || 'FRC')}${a.version ? ' &middot; form v' + esc(a.version) : ''}</div>
        </div>
        <div class="home-btns">
          <a href="#/scouter" class="home-btn home-btn-primary" data-testid="link-scouter"><strong>Scouter</strong><span>Record a match</span></a>
          <a href="#/manager" class="home-btn" data-testid="link-manager"><strong>Manager</strong><span>Scan, review, compare</span></a>
        </div>
        <section class="home-prep offline-panel" aria-labelledby="offline-heading">
          <h2 id="offline-heading">Downloaded website</h2>
          <div id="offline-status"></div>
        </section>
        <section class="home-prep">
          <h2>Get ready for the venue</h2>
          <ol>
            <li>Open online and wait for “Ready for offline use” above.</li>
            <li>Add it to your Home Screen for quick access.</li>
            <li>Reopen it before leaving Wi-Fi to confirm it loads.</li>
          </ol>
          <div class="home-count" data-testid="text-saved-count">${count} match${count === 1 ? '' : 'es'} saved on this device</div>
        </section>
        <section class="home-guides" aria-labelledby="tutorial-heading">
          <h2 id="tutorial-heading">Page tutorials</h2>
          <p class="hint">Open a guide for step-by-step instructions. These guides work offline after preparing this device.</p>
          <details class="home-prep home-tutorial" id="scouter-tutorial">
            <summary>How to use Scouter<span>Record a match and hand it off</span></summary>
            <ol>
              <li><strong>Set up the match.</strong> Choose <strong>Scouter</strong> above, or <strong>Scout</strong> in navigation. In <strong>Setup</strong>, enter the team number, match number, and red or blue alliance. Your scouter name is optional.</li>
              <li><strong>Record what you observe.</strong> Switch section tabs freely during the match. Use −/+ or direct entry for counts, tap choices and switches, and add notes. Each season's form may have different observations.</li>
              <li><strong>Check your draft.</strong> Look for <strong>Draft saved on this device</strong>. Your entries are saved as you work; reopening the same form on this device restores the draft. If it says <strong>Draft not saved</strong>, resolve the storage problem before relying on it.</li>
              <li><strong>Save the finished match.</strong> Select <strong>Save match &amp; show QR</strong>. Fix any highlighted errors. Once saved, keep the QR screen open for your manager.</li>
              <li><strong>Hand off the data.</strong> Have your manager scan the QR in Data's <strong>Collect</strong> view. Or choose <strong>Download CSV backup</strong>, give them the file, and ask them to use <strong>Import CSV</strong> in <strong>Matches</strong>. Use CSV if the match is too large for one QR.</li>
              <li><strong>Review or move on.</strong> <strong>Back to form</strong> lets you review or correct answers. <strong>Next match</strong> starts a fresh form with the next match number; check the team and alliance again. A corrected match must be handed off again—it does not update a manager's previous copy.</li>
            </ol>
            <p class="tutorial-note"><strong>If included in your season's form:</strong> multiple selections let you tap options on or off, and grid counters track each cell independently. Stopwatches offer <strong>Start</strong>, <strong>Pause</strong>, confirmed <strong>Reset</strong>, and editable seconds. Timing continues across section tabs but pauses when you leave Scouter. Recovered draft timers are paused; start them only when you want to resume.</p>
          </details>
          <details class="home-prep home-tutorial" id="data-tutorial">
            <summary>How to use Data (Manager)<span>Collect, review, compare, and back up</span></summary>
            <ol>
              <li><strong>Open your data page.</strong> Choose <strong>Manager</strong> above, or <strong>Data</strong> in navigation. Use <strong>Collect</strong> for receiving scouting records.</li>
              <li><strong>Collect a QR.</strong> Allow camera access and scan the scouter's QR screen. If you already have its compressed transfer text, open <strong>Paste a QR transfer code</strong>, paste it, and select <strong>Collect match</strong>. No shared network is needed for QR handoff.</li>
              <li><strong>Import a CSV instead.</strong> Open <strong>Matches</strong>, select <strong>Import CSV</strong>, and choose the scouter's downloaded backup. Previously collected records are skipped as duplicates, not overwritten.</li>
              <li><strong>Find and review matches.</strong> Choose the correct <strong>Game &amp; form version</strong>. Different form definitions stay separate. In <strong>Matches</strong>, use <strong>Find a team</strong>, select column headings to sort, scroll the table sideways for more fields, and open <strong>Details</strong> for a complete record.</li>
              <li><strong>Compare observations.</strong> Open <strong>Insights</strong> and use <strong>Team view</strong> for all teams or one team. Summaries use only the selected form's configured metrics. Read <strong>What these metrics mean</strong>; small samples can be misleading.</li>
              <li><strong>Export backups regularly.</strong> In <strong>Matches</strong>, <strong>Export this form</strong> downloads its CSV and <strong>Backup all records</strong> preserves every saved match as JSON. <strong>Recovery backup</strong> also preserves drafts and unreadable saved data. Keep backup files somewhere safe before using <strong>Delete</strong> or <strong>Delete all</strong>.</li>
            </ol>
          </details>
          <p class="hint tutorial-safety"><strong>Keep your data safe:</strong> matches and drafts are stored only on this device, not automatically shared or synced. Clearing browser storage can remove them. Export and copy backups to a safe place before deleting data. Scout observations are not official scores.</p>
        </section>
      </main>
    `;
    FRC.offline.render();
  }
};
