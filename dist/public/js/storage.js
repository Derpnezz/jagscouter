window.FRC = window.FRC || {};
FRC.storage = (() => {
  const MATCHES_KEY = 'frc_scouting_matches', DRAFT_KEY = 'frc_scouting_drafts', NAME_KEY = 'frc_scouter_name';
  function read(key, fallback) {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    try { return JSON.parse(value); } catch (_) { throw new Error('Saved data is unreadable. Download the recovery backup before changing this device’s data.'); }
  }
  function getMatches() {
    const result = read(MATCHES_KEY, []);
    if (!Array.isArray(result)) throw new Error('Saved matches have an unexpected format. Download a recovery backup.');
    return result;
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (_) { throw new Error('Device storage is unavailable or full. Nothing was saved; export a backup or free space before continuing.'); }
  }
  function saveMatch(raw) {
    const record = FRC.records.validate(raw), matches = getMatches();
    if (matches.some(m => m?.id === record.id)) return false;
    matches.push(record);
    write(MATCHES_KEY, matches);
    return true;
  }
  function saveBatch(records) {
    // Validate the complete import before a single atomic storage write.
    const incoming = records.map(FRC.records.validate), matches = getMatches();
    let added = 0;
    for (const r of incoming) if (!matches.some(m => m?.id === r.id)) { matches.push(r); added++; }
    write(MATCHES_KEY,matches);
    return {added, duplicates:incoming.length-added};
  }
  function deleteMatch(id) { write(MATCHES_KEY,getMatches().filter(m => m?.id !== id)); }
  function clearMatches() { localStorage.removeItem(MATCHES_KEY); }
  function getDraft(config) {
    const drafts = read(DRAFT_KEY, []);
    if (!Array.isArray(drafts)) throw new Error('Draft data is unreadable. Download a recovery backup.');
    return drafts.find(d => d.key === FRC.config.key(config))?.state || null;
  }
  function saveDraft(config, state) {
    const drafts = read(DRAFT_KEY, []), key = FRC.config.key(config);
    if (!Array.isArray(drafts)) throw new Error('Draft data is unreadable. Download a recovery backup.');
    const remaining = drafts.filter(d => d.key !== key);
    remaining.push({key,definition:FRC.config.snapshot(config),state});
    write(DRAFT_KEY,remaining);
  }
  function otherDrafts(config) {
    const drafts = read(DRAFT_KEY, []);
    if (!Array.isArray(drafts)) throw new Error('Draft data is unreadable.');
    return drafts.filter(d => d.key !== FRC.config.key(config));
  }
  function recoveryBackup() {
    // Raw strings retain even malformed data without overwriting it.
    return JSON.stringify({matches:localStorage.getItem(MATCHES_KEY),drafts:localStorage.getItem(DRAFT_KEY)},null,2);
  }
  return {
    getMatches, saveMatch, saveBatch, deleteMatch, clearMatches, getDraft, saveDraft, otherDrafts, recoveryBackup,
    getScouterName: () => localStorage.getItem(NAME_KEY) || '',
    saveScouterName: name => { try { localStorage.setItem(NAME_KEY,name); } catch (_) { throw new Error('Scouter name could not be saved.'); } }
  };
})();