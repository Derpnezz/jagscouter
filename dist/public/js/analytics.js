window.FRC = window.FRC || {};
FRC.analytics = (() => {
  const avg = arr => arr.length ? arr.reduce((a,b) => a+b,0)/arr.length : 0;
  function metric(record, definition) {
    if (definition.operation === 'sum') return definition.fields.reduce((sum,id) => sum + record.answers[id],0);
    return definition.values.includes(record.answers[definition.field]) ? 100 : 0;
  }
  function teamStats(records, config) {
    const teams = new Map();
    for (const r of records) {
      if (FRC.config.key(r.definition) !== FRC.config.key(config)) throw new Error('Cannot mix different form definitions in statistics.');
      if (!teams.has(r.teamNumber)) teams.set(r.teamNumber,[]);
      teams.get(r.teamNumber).push(r);
    }
    return [...teams].map(([teamNumber,matches]) => ({
      teamNumber, matches:matches.length,
      metrics:Object.fromEntries(config.metrics.map(m => [m.id,avg(matches.map(r => metric(r,m)))]))
    }));
  }
  return {avg, metric, teamStats};
})();