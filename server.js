// server.js
// India Pincode Explorer — backend
// Serves the frontend + two API routes:
//   GET  /api/resolve?q=<pincode or place name>   -> real postal data (india post api)
//   POST /api/insights                            -> short AI writeup about the resolved place

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const INDIA_POST_BASE = 'https://api.postalpincode.in';
const isPincode = (q) => /^\d{6}$/.test(q.trim());

// ---------- helpers ----------

function normalizeOffice(office) {
  return {
    pincode: office.Pincode || '',
    postOffice: office.Name || '',
    area: office.Name || '',
    district: office.District || '',
    state: office.State || '',
    region: office.Region || '',
    division: office.Division || '',
    branchType: office.BranchType || ''
  };
}

async function fetchFromIndiaPost(query) {
  const endpoint = isPincode(query)
    ? `${INDIA_POST_BASE}/pincode/${encodeURIComponent(query.trim())}`
    : `${INDIA_POST_BASE}/postoffice/${encodeURIComponent(query.trim())}`;

  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`India Post API responded ${res.status}`);
  const json = await res.json();

  const first = Array.isArray(json) ? json[0] : null;
  if (!first || first.Status !== 'Success' || !Array.isArray(first.PostOffice) || first.PostOffice.length === 0) {
    return { resolved: false, message: (first && first.Message) || 'No matching post office found.' };
  }

  const offices = first.PostOffice.map(normalizeOffice);
  return { resolved: true, primary: offices[0], alternates: offices.slice(1, 6) };
}

async function askClaude(promptText) {
  if (!ANTHROPIC_API_KEY) return null;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: promptText }]
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const block = (data.content || []).find((b) => b.type === 'text');
  return block ? block.text : null;
}

function fallbackInsight(loc) {
  const parts = [];
  parts.push(`${loc.area || loc.postOffice} is served by the ${loc.postOffice} post office in ${loc.district}, ${loc.state}.`);
  if (loc.region) parts.push(`It falls under the ${loc.region} postal region${loc.division ? `, ${loc.division} division` : ''}.`);
  if (loc.branchType) parts.push(`Branch type on record: ${loc.branchType}.`);
  return parts.join(' ');
}

// ---------- routes ----------

// Resolve a pincode or place name to real postal data
app.get('/api/resolve', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ resolved: false, message: 'Missing query param "q".' });

  try {
    const result = await fetchFromIndiaPost(q);

    if (result.resolved) {
      return res.json({ resolved: true, source: 'india-post-api', ...result });
    }

    // No direct match — try an AI-assisted guess at what the user meant, if a key is configured
    if (ANTHROPIC_API_KEY) {
      const guessPrompt = [
        `A user searched an Indian postal lookup tool for: "${q}"`,
        'This did not match any post office directly (likely a typo, an abbreviation, or an approximate/colloquial area name).',
        'Reply with ONLY the single most likely correctly-spelled Indian place or post office name they meant (2-5 words), nothing else. No punctuation, no explanation.'
      ].join(' ');

      try {
        const guess = await askClaude(guessPrompt);
        const cleanGuess = (guess || '').trim().replace(/^["']|["']$/g, '');
        if (cleanGuess) {
          const retry = await fetchFromIndiaPost(cleanGuess);
          if (retry.resolved) {
            return res.json({
              resolved: true,
              source: 'india-post-api',
              aiCorrected: true,
              correctedQuery: cleanGuess,
              ...retry
            });
          }
        }
      } catch (aiErr) {
        console.error('AI fallback guess failed:', aiErr.message);
      }
    }

    return res.json({ resolved: false, source: 'india-post-api', message: result.message });
  } catch (err) {
    console.error('resolve error:', err.message);
    return res.status(502).json({ resolved: false, message: 'Could not reach the postal data source. Try again.' });
  }
});

// Generate (or fall back to a templated) short insight about a resolved location
app.post('/api/insights', async (req, res) => {
  const loc = req.body || {};
  if (!loc.postOffice && !loc.pincode) {
    return res.status(400).json({ message: 'Missing location data.' });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.json({ insights: fallbackInsight(loc), nearbyPincodes: [], aiGenerated: false });
  }

  const prompt = [
    'Given this real Indian postal location data (already verified, do not contradict it):',
    JSON.stringify({
      pincode: loc.pincode, postOffice: loc.postOffice, district: loc.district,
      state: loc.state, region: loc.region, division: loc.division
    }),
    'Write a short, honest 2-3 sentence "local profile" in plain conversational language: general character of the area, connectivity, what the district/state is known for. Do not invent hyper-specific facts (exact landmarks, businesses) you are not confident about — keep it general and truthful.',
    'Then on a new line, output up to 4 real-looking nearby 6-digit pincodes if you have reasonable knowledge of them, comma-separated, prefixed with "NEARBY:". If unsure, write "NEARBY:" with nothing after it.'
  ].join('\n');

  try {
    const text = await askClaude(prompt);
    if (!text) return res.json({ insights: fallbackInsight(loc), nearbyPincodes: [], aiGenerated: false });

    const [profilePart, nearbyLine] = text.split(/NEARBY:/i);
    const nearbyPincodes = (nearbyLine || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\d{6}$/.test(s))
      .slice(0, 4);

    return res.json({
      insights: profilePart.trim() || fallbackInsight(loc),
      nearbyPincodes,
      aiGenerated: true
    });
  } catch (err) {
    console.error('insights AI error:', err.message);
    return res.json({ insights: fallbackInsight(loc), nearbyPincodes: [], aiGenerated: false });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, aiEnabled: Boolean(ANTHROPIC_API_KEY) });
});

app.listen(PORT, () => {
  console.log(`India Pincode Explorer running on http://localhost:${PORT}`);
  console.log(`AI insights: ${ANTHROPIC_API_KEY ? 'enabled' : 'disabled (set ANTHROPIC_API_KEY in .env to enable)'}`);
});