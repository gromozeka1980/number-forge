// localStorage helpers for campaign progress

const STORAGE_KEY = 'numberforge_campaign';

const DEFAULT_CAMPAIGN = {
  version: 1,
  levels: {
    'prebuilt_1_2_3': { numbers: [1, 2, 3], solved: [], reachable: null },
    'prebuilt_2_6_8': { numbers: [2, 6, 8], solved: [], reachable: null },
    'prebuilt_3_7_9': { numbers: [3, 7, 9], solved: [], reachable: null },
    'prebuilt_1_2_3_4': { numbers: [1, 2, 3, 4], solved: [], reachable: null },
    'prebuilt_3_5_7_9': { numbers: [3, 5, 7, 9], solved: [], reachable: null },
  },
};

export function loadCampaign() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_CAMPAIGN);
    const data = JSON.parse(raw);
    // Ensure pre-built levels always exist
    for (const [id, level] of Object.entries(DEFAULT_CAMPAIGN.levels)) {
      if (!data.levels[id]) {
        data.levels[id] = structuredClone(level);
      }
    }
    return data;
  } catch {
    return structuredClone(DEFAULT_CAMPAIGN);
  }
}

export function saveCampaign(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function markSolved(levelId, targetNumber) {
  const data = loadCampaign();
  const level = data.levels[levelId];
  if (!level) return;
  if (!level.solved.includes(targetNumber)) {
    level.solved.push(targetNumber);
    level.solved.sort((a, b) => a - b);
  }
  saveCampaign(data);
}

export function setReachable(levelId, reachable) {
  const data = loadCampaign();
  const level = data.levels[levelId];
  if (!level) return;
  level.reachable = reachable;
  saveCampaign(data);
}

export function addCustomLevel(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const id = 'custom_' + sorted.join('_');
  const data = loadCampaign();
  if (data.levels[id]) return id; // Already exists
  data.levels[id] = { numbers: sorted, solved: [], reachable: null };
  saveCampaign(data);
  return id;
}

export function deleteCustomLevel(levelId) {
  if (!levelId.startsWith('custom_')) return;
  const data = loadCampaign();
  delete data.levels[levelId];
  saveCampaign(data);
}

export function getLevelList() {
  const data = loadCampaign();
  const prebuilt = [];
  const custom = [];
  for (const [id, level] of Object.entries(data.levels)) {
    const entry = { id, ...level };
    if (id.startsWith('prebuilt_')) prebuilt.push(entry);
    else custom.push(entry);
  }
  // Sort prebuilt by number count
  prebuilt.sort((a, b) => a.numbers.length - b.numbers.length);
  return [...prebuilt, ...custom];
}
