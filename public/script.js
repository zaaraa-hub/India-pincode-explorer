(function () {
  const el = (id) => document.getElementById(id);
  const queryInput = el('query');
  const goBtn = el('go');
  const chips = el('chips');
  const loading = el('loading');
  const loadingText = el('loadingText');
  const banner = el('banner');
  const card = el('card');
  const routeLine = el('routeLine');
  const routeFill = el('routeFill');
  const statusBadge = el('statusBadge');
  const aiHint = el('aiHint');

  const LOADING_MESSAGES = [
    'tracing the route…',
    'checking the sorting office…',
    'reading the postmark…',
    'cross-referencing the district…'
  ];

  let aiEnabled = false;

  fetch('/api/health')
    .then((r) => r.json())
    .then((d) => {
      aiEnabled = Boolean(d.aiEnabled);
      aiHint.textContent = aiEnabled
        ? 'Typos and rough area names are fine — resolution is AI-assisted.'
        : 'Live India Post data. Add ANTHROPIC_API_KEY on the server for AI profiles + typo correction.';
    })
    .catch(() => {
      aiHint.textContent = 'Live India Post data.';
    });

  function loadRecent() {
    try {
      const raw = localStorage.getItem('pincode-explorer-recent');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveRecent(q) {
    try {
      let list = loadRecent().filter((x) => x.toLowerCase() !== q.toLowerCase());
      list.unshift(q);
      list = list.slice(0, 6);
      localStorage.setItem('pincode-explorer-recent', JSON.stringify(list));
      renderChips();
    } catch (e) {}
  }
  function renderChips() {
    const list = loadRecent();
    chips.innerHTML = '';
    const defaults = ['110001', 'bandra west', 'koramangala', 'connaught place'];
    (list.length ? list : defaults).forEach(addChip);
  }
  function addChip(text) {
    const c = document.createElement('div');
    c.className = 'chip';
    c.textContent = text;
    c.addEventListener('click', () => { queryInput.value = text; runSearch(); });
    chips.appendChild(c);
  }
  renderChips();

  function showBanner(msg) { banner.textContent = msg; banner.className = 'banner show'; }
  function hideBanner() { banner.className = 'banner'; }

  function setLoading(on) {
    if (on) {
      loadingText.textContent = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
      loading.classList.add('show');
      routeLine.classList.add('show');
      routeFill.style.width = '0%';
      requestAnimationFrame(() => { routeFill.style.width = '70%'; });
      goBtn.disabled = true;
      statusBadge.textContent = '● resolving';
    } else {
      loading.classList.remove('show');
      goBtn.disabled = false;
    }
  }
  function finishRoute(ok) {
    routeFill.style.width = ok ? '100%' : '30%';
    routeFill.style.background = ok ? 'var(--teal)' : 'var(--danger)';
    setTimeout(() => {
      routeLine.classList.remove('show');
      routeFill.style.background = 'var(--teal)';
    }, 900);
  }

  function stateAbbrev(state) {
    if (!state) return 'IN';
    const words = state.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  function renderResult(loc, extra) {
    card.classList.remove('show');
    el('rPincode').textContent = loc.pincode || '——0000';
    el('rOffice').textContent = [loc.postOffice, loc.district].filter(Boolean).join(' · ') || 'Unknown office';
    el('rDistrict').textContent = loc.district || '—';
    el('rState').textContent = loc.state || '—';
    el('rRegion').textContent = loc.region || '—';
    el('rDivision').textContent = loc.division || '—';
    el('stampText').textContent = stateAbbrev(loc.state);

    const src = el('rSource');
    src.textContent = extra.aiCorrected ? `CORRECTED FROM "${extra.correctedQueryOriginal}"` : 'INDIA POST · VERIFIED';

    el('insightLbl').textContent = extra.aiGenerated ? 'AI LOCAL PROFILE' : 'SUMMARY';
    el('rInsight').textContent = extra.insights || 'No further detail available.';

    const nearbyWrap = el('nearbyWrap');
    const nearbyChips = el('nearbyChips');
    nearbyChips.innerHTML = '';
    if (Array.isArray(extra.nearbyPincodes) && extra.nearbyPincodes.length) {
      nearbyWrap.style.display = 'flex';
      extra.nearbyPincodes.forEach((p) => {
        const c = document.createElement('div');
        c.className = 'nearby-chip';
        c.textContent = p;
        c.addEventListener('click', () => { queryInput.value = p; runSearch(); });
        nearbyChips.appendChild(c);
      });
    } else {
      nearbyWrap.style.display = 'none';
    }

    const altWrap = el('altWrap');
    const altChips = el('altChips');
    altChips.innerHTML = '';
    if (Array.isArray(extra.alternates) && extra.alternates.length) {
      altWrap.style.display = 'flex';
      extra.alternates.forEach((o) => {
        const c = document.createElement('div');
        c.className = 'alt-chip';
        c.textContent = o.postOffice;
        c.addEventListener('click', () => { renderResult(o, { ...extra, alternates: [] }); });
        altChips.appendChild(c);
      });
    } else {
      altWrap.style.display = 'none';
    }

    requestAnimationFrame(() => { card.classList.add('show'); });
  }

  async function runSearch() {
    const q = queryInput.value.trim();
    if (!q) return;
    hideBanner();
    card.classList.remove('show');
    setLoading(true);

    try {
      const resolveRes = await fetch('/api/resolve?q=' + encodeURIComponent(q));
      const resolveData = await resolveRes.json();

      if (!resolveData.resolved) {
        setLoading(false);
        finishRoute(false);
        showBanner(resolveData.message || "Couldn't find that pincode or place. Try the 6-digit code.");
        statusBadge.textContent = '● not found';
        return;
      }

      const loc = resolveData.primary;
      let extra = {
        insights: '',
        nearbyPincodes: [],
        aiGenerated: false,
        alternates: resolveData.alternates || [],
        aiCorrected: resolveData.aiCorrected || false,
        correctedQueryOriginal: q
      };

      try {
        const insightsRes = await fetch('/api/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loc)
        });
        const insightsData = await insightsRes.json();
        extra.insights = insightsData.insights;
        extra.nearbyPincodes = insightsData.nearbyPincodes || [];
        extra.aiGenerated = Boolean(insightsData.aiGenerated);
      } catch (e) {
        extra.insights = `${loc.postOffice} is in ${loc.district}, ${loc.state}.`;
      }

      setLoading(false);
      finishRoute(true);
      renderResult(loc, extra);
      saveRecent(q);
      statusBadge.textContent = '● ready';
    } catch (err) {
      setLoading(false);
      finishRoute(false);
      showBanner('Could not reach the server. Is it running?');
      statusBadge.textContent = '● error';
    }
  }

  goBtn.addEventListener('click', runSearch);
  queryInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });
})();