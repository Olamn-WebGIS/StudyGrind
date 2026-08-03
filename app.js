const { jsPDF } = window.jspdf || {};

// If pdfjsLib is available (we include pdf.min.js in index.html), set worker path
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

const pdfInput = document.getElementById('pdfInput');
const dropZone = document.getElementById('dropZone');
const progressBox = document.getElementById('progressBox');
const resultBox = document.getElementById('resultBox');
const summarizeButton = document.getElementById('summarizeButton');
const statusText = document.getElementById('statusText');
const pageNum = document.getElementById('pageNum');
const totalPages = document.getElementById('totalPages');
const progressFill = document.getElementById('progressFill');
const output = document.getElementById('output');
const summarySection = document.getElementById('summarySection');
const freeCalculator = document.getElementById('freeCalculator');
const downloadBtn = document.getElementById('downloadBtn');
const fileName = document.getElementById('fileName');
const pointsBadge = document.getElementById('pointsBadge');
const streakText = document.getElementById('streakText');
const nextRewardText = document.getElementById('nextRewardText');
const rewardMessage = document.getElementById('rewardMessage');
const installToast = document.getElementById('installToast');
const installToastBtn = document.getElementById('installToastBtn');
const installToastClose = document.getElementById('installToastClose');
let deferredInstallPrompt = null;
let selectedFile = null;

const POINTS_PER_DAILY_SUMMARY = 5;
const REWARD_THRESHOLD = 100;
const REWARD_AIRTIME_VALUE = 500;
const STORAGE_KEY = 'studygrindGamification';

const getTodayKey = () => new Date().toISOString().split('T')[0];

const loadGamificationState = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  const defaultState = {
    points: 0,
    streak: 0,
    lastAwardDate: '',
    lastVisitDate: '',
    rewardCount: 0,
    redeemedCount: 0
  };

  if (!stored) {
    return defaultState;
  }

  try {
    const parsed = JSON.parse(stored);
    return {
      ...defaultState,
      ...parsed
    };
  } catch {
    return defaultState;
  }
};

const saveGamificationState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const getPendingRewards = (state) => {
  const unlockedRewards = Math.floor((state.points || 0) / REWARD_THRESHOLD);
  const redeemed = state.redeemedCount || 0;
  return Math.max(0, unlockedRewards - redeemed);
};

const updateRewardRedemptionUI = (state) => {
  const pending = getPendingRewards(state);
  const redeemButton = document.getElementById('redeemRewardBtn');
  const redeemForm = document.getElementById('redeemForm');
  const redeemStatus = document.getElementById('redeemStatus');

  if (redeemButton) {
    redeemButton.style.display = 'inline-flex';
    redeemButton.innerText = `Redeem ₦${REWARD_AIRTIME_VALUE} airtime`;
  }

  if (redeemForm && pending === 0) {
    redeemForm.classList.add('hidden');
    if (redeemStatus) redeemStatus.innerText = '';
  }

  if (nextRewardText) {
    nextRewardText.innerText = pending > 0
      ? `You have ${pending} reward ready to redeem.`
      : `Next airtime reward at ${Math.max(REWARD_THRESHOLD - (state.points % REWARD_THRESHOLD), 0)} points`;
  }
};

const updateGamificationUI = (state, message) => {
  if (pointsBadge) pointsBadge.innerText = `${state.points} pts`;
  if (streakText) streakText.innerText = `Daily streak: ${state.streak} days`;
  if (rewardMessage) rewardMessage.innerText = message || 'Stay consistent and earn airtime rewards for daily study.';
  updateRewardRedemptionUI(state);
};

const getDateDifference = (fromDate, toDate) => {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const diff = Math.floor((to - from) / (1000 * 60 * 60 * 24));
  return diff;
};

const applyAirtimeReward = (state) => {
  const earnedRewards = Math.floor(state.points / REWARD_THRESHOLD);
  if (earnedRewards > state.rewardCount) {
    state.rewardCount = earnedRewards;
    saveGamificationState(state);
    return true;
  }
  return false;
};

const awardDailyPoints = () => {
  const state = loadGamificationState();
  const today = getTodayKey();
  const diff = state.lastAwardDate ? getDateDifference(state.lastAwardDate, today) : null;

  if (state.lastAwardDate === today) {
    updateGamificationUI(state, 'You already earned today’s study points. Keep studying tomorrow!');
    return;
  }

  if (diff === 1) {
    state.streak += 1;
  } else {
    state.streak = 1;
  }

  state.points += POINTS_PER_DAILY_SUMMARY;
  state.lastAwardDate = today;
  state.lastVisitDate = today;

  const rewardUnlocked = applyAirtimeReward(state);
  const message = rewardUnlocked
    ? `Nice work! You reached ${state.rewardCount * REWARD_THRESHOLD} points and unlocked an airtime reward.`
    : `Great job! You earned ${POINTS_PER_DAILY_SUMMARY} points for studying today.`;

  saveGamificationState(state);
  updateGamificationUI(state, message);
};

const initializeGamification = () => {
  const state = loadGamificationState();
  const today = getTodayKey();
  const diff = state.lastVisitDate ? getDateDifference(state.lastVisitDate, today) : null;

  if (state.lastVisitDate !== today) {
    if (diff === 1) {
      state.streak = Math.max(state.streak, 1);
    } else if (state.lastVisitDate && diff > 1) {
      state.streak = 0;
    }
    state.lastVisitDate = today;
    saveGamificationState(state);
  }

  // Ensure saved points correctly reflect unlocked rewards
  const expectedRewardCount = Math.floor(state.points / REWARD_THRESHOLD);
  if (state.rewardCount !== expectedRewardCount) {
    state.rewardCount = expectedRewardCount;
    saveGamificationState(state);
  }

  updateGamificationUI(state, 'Open the app and summarize a PDF to earn study points.');
};

const getCurrentGamificationState = () => loadGamificationState();

const redeemAirtimeReward = () => {
  const state = loadGamificationState();
  const pending = getPendingRewards(state);
  const phoneInput = document.getElementById('rewardPhone');
  const networkSelect = document.getElementById('rewardNetwork');
  const redeemStatus = document.getElementById('redeemStatus');

  if (!phoneInput || !networkSelect || !redeemStatus) return;

  const phone = phoneInput.value.trim();
  const network = networkSelect.value;
  const validPhone = /^\d{10,11}$/.test(phone);

  if (pending <= 0) {
    redeemStatus.innerText = 'No airtime reward is available to redeem yet.';
    return;
  }

  if (!validPhone) {
    redeemStatus.innerText = 'Enter a valid phone number (10–11 digits).';
    return;
  }

  if (!network) {
    redeemStatus.innerText = 'Please select your network provider.';
    return;
  }

  state.redeemedCount = (state.redeemedCount || 0) + 1;
  saveGamificationState(state);
  updateGamificationUI(state, `Success! ${REWARD_AIRTIME_VALUE} airtime will be sent to ${phone} on ${network}.`);
  redeemStatus.innerText = `Reward claimed for ${phone} on ${network}.`;
};

const handleSummaryComplete = () => {
  const state = loadGamificationState();
  if (state.lastAwardDate !== getTodayKey()) {
    awardDailyPoints();
  } else {
    updateGamificationUI(state, 'You already earned points for today. Keep up the momentum!');
  }
};

const setupInstallPrompt = () => {
  if (!installToast || !installToastBtn) return;

  // Check if running on iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  console.log('[PWA] iOS detected:', isIOS);

  // iOS doesn't support beforeinstallprompt, but we can show custom instructions
  const showIOSInstallPrompt = () => {
    console.log('[PWA] Showing iOS-specific install instructions');
    const span = installToast.querySelector('span');
    if (span) {
      span.innerHTML = '<strong>📱 Add to Home Screen:</strong> Tap Share and select "Add to Home Screen" to use StudyGrind as an app.';
    }
    installToast.classList.remove('hidden');
    installToast.classList.add('visible');
    setTimeout(() => {
      if (installToast) {
        installToast.classList.remove('visible');
        installToast.classList.add('hidden');
      }
    }, 10000);
  };

  // Show iOS prompt on load if on iOS (no beforeinstallprompt support)
  if (isIOS) {
    window.addEventListener('load', () => {
      console.log('[PWA] iOS load event - showing iOS install prompt');
      setTimeout(showIOSInstallPrompt, 1000);
    });
  } else {
    // Android and desktop: wait for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (event) => {
      console.log('[PWA] beforeinstallprompt event fired');
      event.preventDefault();
      deferredInstallPrompt = event;
      installToast.classList.remove('hidden');
      installToast.classList.add('visible');
      console.log('[PWA] Install toast shown');
      setTimeout(() => {
        if (installToast) {
          installToast.classList.remove('visible');
          installToast.classList.add('hidden');
          console.log('[PWA] Install toast auto-hidden after 8s');
        }
      }, 8000);
    });
  }

  installToastBtn.addEventListener('click', async () => {
    console.log('[PWA] Install button clicked');
    if (!deferredInstallPrompt) {
      console.log('[PWA] No install prompt available (likely iOS)');
      return;
    }
    deferredInstallPrompt.prompt();
    const choiceResult = await deferredInstallPrompt.userChoice;
    if (installToast) {
      installToast.classList.remove('visible');
      installToast.classList.add('hidden');
    }
    deferredInstallPrompt = null;
    if (choiceResult.outcome === 'accepted') {
      console.log('[PWA] Installation accepted');
      if (rewardMessage) rewardMessage.innerText = 'StudyGrind is installed. Open it from your home screen anytime.';
    } else {
      console.log('[PWA] Installation dismissed');
    }
  });

  installToastBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    console.log('[PWA] Install button touched');
    installToastBtn.click();
  });

  if (installToastClose) {
    installToastClose.addEventListener('click', () => {
      console.log('[PWA] Install toast closed manually');
      if (installToast) {
        installToast.classList.remove('visible');
        installToast.classList.add('hidden');
      }
      deferredInstallPrompt = null;
    });
    installToastClose.addEventListener('touchend', (e) => {
      e.preventDefault();
      installToastClose.click();
    });
  }

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed!');
    installToast.classList.add('hidden');
    if (rewardMessage) rewardMessage.innerText = 'App installed! You can now launch StudyGrind from your device.';
  });
};

const initializeApp = () => {
  initializeGamification();
  setupInstallPrompt();
  const redeemButton = document.getElementById('redeemRewardBtn');
  const redeemSubmitBtn = document.getElementById('redeemSubmitBtn');
  const redeemForm = document.getElementById('redeemForm');

  if (redeemButton) {
    const toggleRedeemForm = () => {
      const state = loadGamificationState();
      const pending = getPendingRewards(state);
      if (pending <= 0) {
        const message = `Reach ${REWARD_THRESHOLD} points first to claim ₦${REWARD_AIRTIME_VALUE} airtime.`;
        alert(message);
        updateGamificationUI(state, message);
        return;
      }
      if (redeemForm) {
        redeemForm.classList.toggle('hidden');
      }
    };
    redeemButton.addEventListener('click', toggleRedeemForm);
    redeemButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      toggleRedeemForm();
    });
    redeemButton.addEventListener('pointerdown', (e) => {
      e.preventDefault();
    });
    redeemButton.innerText = `Redeem ₦${REWARD_AIRTIME_VALUE} airtime`;
  }

  if (redeemSubmitBtn) {
    redeemSubmitBtn.addEventListener('click', redeemAirtimeReward);
  }

  if (pointsBadge) {
    pointsBadge.style.cursor = 'pointer';
    pointsBadge.addEventListener('click', () => {
      const state = loadGamificationState();
      const pending = getPendingRewards(state);
      if (pending > 0) {
        if (redeemForm) redeemForm.style.display = 'block';
      } else {
        const message = `Reach ${REWARD_THRESHOLD} points first to claim ${REWARD_AIRTIME_VALUE} naira airtime.`;
        alert(message);
        updateGamificationUI(state, message);
      }
    });
  }
};

initializeApp();

const showProgress = () => {
  if (progressBox) {
    progressBox.classList.remove('hidden');
    progressBox.style.display = 'block';
  }
};

const hideProgress = () => {
  if (progressBox) {
    progressBox.classList.add('hidden');
    progressBox.style.display = 'none';
  }
};

if (summarySection) {
  summarySection.classList.add('hidden');
}
if (progressBox) {
  progressBox.classList.add('hidden');
  progressBox.style.display = 'none';
}

const updateStatus = (message, showProgress = false) => {
  if (statusText) statusText.innerText = message;
  if (progressBox && showProgress) {
    progressBox.classList.remove('hidden');
  }
};

// No backend: use pdf.js in-browser text extraction

const normalizeText = (text) => text.replace(/\s+/g, ' ').trim();

const splitSentences = (text) => {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
};

function extractTopSentences(text, n) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const scored = sentences.map(s => {
    let score = 0;
    if(/is defined as|known as|called|equals|=|where/i.test(s)) score += 5; // definitions/formulas
    if(/Γ|∫|property/i.test(s)) score += 4; // math
    if(/Gamma|Beta|Euler|factorial/i.test(s)) score += 3;
    if(s.length > 50 && s.length < 250) score += 2;
    return {s: s.trim(), score};
  });
  return scored.sort((a,b) => b.score - a.score).slice(0,n).map(x => x.s);
}
  function cleanText(text) {
    return text
     .replace(/^\d+\s*|\s*\d+\s*$/g, '') // remove page numbers
     .replace(/�|□|_/g, '') // remove broken symbols from pdf.js
     .replace(/\s+/g, ' ') // collapse spaces
     .trim();
  }

  function extractTopSentences(text, n) {
    text = cleanText(text);
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const scored = sentences.map(s => {
      let score = 0;
      if(s.length < 20) return {s, score: -10}; // ignore too short
      if(/is defined as|known as|called|equals|where|graphical/i.test(s)) score += 5;
      if(/Gamma|Beta|Euler|prove|integral/i.test(s)) score += 3;
      if(s.length > 50 && s.length < 300) score += 2;
      return {s: s.trim(), score};
    });
    return scored.sort((a,b) => b.score - a.score).slice(0,n).map(x => x.s);
  }

const tokenizeWords = (text) => {
  return (text.toLowerCase().match(/\b[a-z]{5,}\b/g) || []).map((word) => word.toLowerCase());
};

const buildFrequency = (words) => {
  return words.reduce((freq, word) => {
    freq[word] = (freq[word] || 0) + 1;
    return freq;
  }, {});
};

const topKeywords = (text, count = 5) => {
  const words = tokenizeWords(text);
  const frequency = buildFrequency(words);
  return Object.entries(frequency)
    .sort(([wordA, countA], [wordB, countB]) => {
      if (countB !== countA) return countB - countA;
      return wordA.localeCompare(wordB);
    })
    .slice(0, count)
    .map(([word]) => word);
};

function extractKeywords(text) {
  const stopWords = new Set(['the','is','are','of','and','to','a','in','for','with','on','as','an','by','from','this','these','that','which','function','functions']);
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const freq = {};
  words.forEach(w => { if(!stopWords.has(w)) freq[w] = (freq[w]||0)+1 });

  // grab formulas too
  const formulas = text.match(/Γ\([^)]+\)|∫/g) || [];
  return [...new Set([...formulas.slice(0,1),...Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([w])=>w)])];
}

function normalizeWikipediaTopic(topic) {
  return topic
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function getWikipediaSummary(topic) {
  if (!topic) return null;
  const normalizedTopic = normalizeWikipediaTopic(topic);
  const variants = [normalizedTopic, normalizedTopic.replace(/ /g, '_')];

  for (const candidate of variants) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate)}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      return data.extract || null;
    } catch (e) {
      console.log('Wikipedia fetch failed for', candidate, e);
    }
  }

  // Fallback to Wikipedia search API for a best-match title
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(normalizedTopic)}&utf8=&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const firstHit = searchData.query?.search?.[0]?.title;
    if (!firstHit) return null;
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstHit)}`;
    const summaryRes = await fetch(summaryUrl);
    if (!summaryRes.ok) return null;
    const summaryData = await summaryRes.json();
    return summaryData.extract || null;
  } catch (e) {
    console.log('Wikipedia search fallback failed', e);
  }

  return null;
}

const FREE_FORMULAS = [
  { name: 'Newton’s 2nd law', formula: 'F = m * a', unit: 'N' },
  { name: 'SUVAT: v = u + a*t', formula: 'v = u + a * t', unit: 'm/s' },
  { name: 'SUVAT: s = u*t + 1/2*a*t^2', formula: 's = u * t + 0.5 * a * t^2', unit: 'm' },
  { name: 'Ideal gas law', formula: 'p * V = n * R * T', unit: 'Pa' },
  { name: 'Einstein mass-energy', formula: 'E = m * c^2', unit: 'J' },
  { name: 'Ohm’s law', formula: 'V = I * R', unit: 'V' },
  { name: 'Kinetic energy', formula: 'KE = 0.5 * m * v^2', unit: 'J' },
  { name: 'Work', formula: 'W = F * d * cos(theta)', unit: 'J' },
  { name: 'Pressure', formula: 'p = F / A', unit: 'Pa' },
  { name: 'Torque', formula: 'tau = cross(r, F)', unit: 'N*m' },
  { name: 'Magnetic force', formula: 'F = q * cross(v, B)', unit: 'N' },
  { name: 'Coulomb’s law', formula: 'F = k * q1 * q2 / r^2', unit: 'N' },
  { name: 'Wave speed', formula: 'v = f * lambda', unit: 'm/s' },
  { name: 'Power', formula: 'P = W / t', unit: 'W' },
  { name: 'Momentum', formula: 'p = m * v', unit: 'kg*m/s' },
  { name: 'Heat transfer', formula: 'Q = m * c * dT', unit: 'J' },
  { name: 'Enthalpy change', formula: 'H = m * c * dT', unit: 'J' },
  { name: 'Carnot efficiency', formula: 'eta = 1 - Tc / Th', unit: '' },
  { name: 'Heat transfer (conduction)', formula: 'Q = k * A * dT / L', unit: 'W' },
  { name: 'Heat transfer (convection)', formula: 'Q = h * A * dT', unit: 'W' },
  { name: 'Pump power', formula: 'P = rho * g * Q * H', unit: 'W' },
  { name: 'Work by gas', formula: 'W = P * dV', unit: 'J' },
  { name: 'Inductive reactance', formula: 'X_L = 2 * pi * f * L', unit: 'ohm' },
  { name: 'Capacitive reactance', formula: 'X_C = 1 / (2 * pi * f * C)', unit: 'ohm' },
  { name: 'Continuity equation', formula: 'A1 * v1 = A2 * v2', unit: 'm^3/s' },
  { name: 'Head loss', formula: 'h_f = f * L * v^2 / (2 * g * D)', unit: 'm' },
  { name: 'Equivalent resistance (series)', formula: 'R_eq = R1 + R2', unit: 'ohm' },
  { name: 'Bending stress', formula: 'sigma = M * y / I', unit: 'Pa' },
  { name: 'Gravitational potential energy', formula: 'E = m * g * h', unit: 'J' },
  { name: 'Electrical power', formula: 'P = V * I', unit: 'W' },
  { name: 'Circle area', formula: 'A = pi * r^2', unit: 'm^2' },
  { name: 'Sphere volume', formula: 'V = 4/3 * pi * r^3', unit: 'm^3' },
  { name: 'Electric current', formula: 'I = Q / t', unit: 'A' },
  { name: 'Hydrostatic pressure', formula: 'p = rho * g * h', unit: 'Pa' },
  { name: 'Electric force', formula: 'F = q * E', unit: 'N' },
  { name: 'Lorentz force', formula: 'F = q * (E + cross(v, B))', unit: 'N' },
  { name: 'Centripetal force', formula: 'F = m * v^2 / r', unit: 'N' },
  { name: 'Angular momentum', formula: 'L = I * w', unit: 'kg*m^2/s' },
  { name: 'Rotational kinetic energy', formula: 'KE = 0.5 * I * w^2', unit: 'J' },
  { name: 'Spring force', formula: 'F = k * x', unit: 'N' },
  { name: 'Spring potential energy', formula: 'PE = 0.5 * k * x^2', unit: 'J' },
  { name: 'Mass-spring period', formula: 'T = 2 * pi * sqrt(m / k)', unit: 's' },
  { name: 'Efficiency', formula: 'eta = W / Qh', unit: '' },
  { name: 'Capacitor energy', formula: 'Q = 0.5 * C * V^2', unit: 'J' },
  { name: 'Capacitor charge', formula: 'Q = C * V', unit: 'C' },
  { name: 'Capacitance', formula: 'C = eps0 * A / d', unit: 'F' },
  { name: 'Density', formula: 'rho = m / V', unit: 'kg/m^3' },
  { name: 'Buoyancy force', formula: 'Fb = rho * V * g', unit: 'N' },
  { name: 'Power dissipation', formula: 'P = I^2 * R', unit: 'W' },
  { name: 'Electric field', formula: 'E = V / d', unit: 'V/m' },
  { name: 'Force on wire', formula: 'F = I * L * B', unit: 'N' },
  { name: 'Magnetic field', formula: 'B = mu0 * I / (2 * pi * r)', unit: 'T' },
  { name: 'Inductor energy', formula: 'E = 0.5 * L * I^2', unit: 'J' },
  { name: 'Frequency-period relation', formula: 'f = 1 / T', unit: 'Hz' },
  { name: 'Escape velocity', formula: 'v = sqrt(2 * G * M / r)', unit: 'm/s' },
  { name: 'Gravitational force', formula: 'F = G * m1 * m2 / r^2', unit: 'N' },
  { name: 'Lens equation', formula: '1/f = 1/do + 1/di', unit: '1/m' },
  { name: 'Magnification', formula: 'm = -di / do', unit: '' },
  { name: 'Snell’s law', formula: 'n1 * sin(theta1) = n2 * sin(theta2)', unit: '' },
  { name: 'Magnetic flux', formula: 'phi = B * A * cos(theta)', unit: 'Wb' },
  { name: 'de Broglie wavelength', formula: 'lambda = h / p', unit: 'm' },
  { name: 'Photon energy', formula: 'E = h * f', unit: 'J' },
  { name: 'Stress', formula: 'sigma = F / A', unit: 'Pa' },
  { name: 'Strain', formula: 'epsilon = dL / L', unit: '' },
  { name: 'Youngs modulus', formula: 'E = sigma / epsilon', unit: 'Pa' },
  { name: 'Reynolds number', formula: 'Re = rho * v * d / mu', unit: '' },
  { name: 'Flow rate', formula: 'Q = A * v', unit: 'm^3/s' },
  { name: 'Resistance of wire', formula: 'R = rho_r * L / A', unit: 'ohm' },
  { name: 'Beam deflection', formula: 'y = F * L^3 / (3 * E * I2)', unit: 'm' },
  { name: 'LC resonant frequency', formula: 'f = 1 / (2 * pi * sqrt(L * C))', unit: 'Hz' },
  { name: 'Circumference', formula: 'circ = 2 * pi * r', unit: 'm' },
  { name: 'Triangle area', formula: 'A = 0.5 * b * h', unit: 'm^2' },
  { name: 'Arithmetic series', formula: 'S = n / 2 * (a1 + an)', unit: '' },
  { name: 'Quadratic formula', formula: 'x = (-b + sqrt(b^2 - 4 * a * c)) / (2 * a)', unit: '' },
  { name: 'Geometric series', formula: 'S = a1 * (1 - r^n) / (1 - r)', unit: '' },
  { name: 'Exponential growth', formula: 'N = N0 * exp(k * t)', unit: '' },
  { name: 'Binomial coefficient', formula: 'nCr = factorial(n) / (factorial(r) * factorial(n - r))', unit: '' },
  { name: 'Complex magnitude', formula: 'z = sqrt(x^2 + y^2)', unit: '' },
  { name: 'Permutation count', formula: 'P = factorial(n) / factorial(n - r)', unit: '' },
  { name: 'Linear function', formula: 'y = m * x + b', unit: '' },
  { name: 'Quadratic equation', formula: 'a * x^2 + b * x + c = 0', unit: '' }
];

const CONSTANTS = {
  c: 299792458,
  R: 8.314462618,
  G: 6.67430e-11,
  g: 9.81,
  h: 6.62607015e-34,
  k: 1.380649e-23,
  mu0: 4 * Math.PI * 1e-7,
  eps0: 8.8541878128e-12,
  e: Math.E,
  pi: Math.PI
};

const FUNCTION_NAMES = new Set([
  'sin','cos','tan','asin','acos','atan','sqrt','cbrt','log','ln','exp','abs','ceil','floor','round','min','max','gamma','pi','e','pow','sec','csc','cot','cross','dot'
]);

const CONSTANT_NAMES = new Set(Object.keys(CONSTANTS));

const UNIT_SETS = {
  m: ['m', 'km', 'cm', 'mm'],
  'm/s': ['m/s', 'km/h'],
  'm/s^2': ['m/s^2', 'km/h^2'],
  'm^2': ['m^2', 'cm^2'],
  'm^3': ['m^3', 'L', 'cm^3'],
  'm^3/s': ['m^3/s', 'L/s'],
  J: ['J', 'kJ', 'cal', 'kcal'],
  N: ['N', 'kN'],
  Pa: ['Pa', 'kPa', 'bar'],
  V: ['V', 'mV', 'kV'],
  'V/m': ['V/m'],
  'W/mK': ['W/mK'],
  'W/m^2K': ['W/m^2K'],
  H: ['H'],
  F: ['F'],
  'kg/m^3': ['kg/m^3', 'g/cm^3'],
  A: ['A', 'mA', 'kA'],
  ohm: ['ohm', 'kohm', 'Mohm'],
  s: ['s', 'min', 'h'],
  kg: ['kg', 'g', 'mg'],
  mol: ['mol'],
  C: ['C', 'mC'],
  T: ['T', 'mT'],
  F: ['F'],
  H: ['H'],
  Wb: ['Wb'],
  'm^3/s': ['m^3/s'],
  'ohm*m': ['ohm*m'],
  'Pa*s': ['Pa*s'],
  'm^4': ['m^4'],
  Hz: ['Hz', 'kHz', 'MHz'],
  K: ['K'],
  'kg*m/s': ['kg*m/s'],
  'N*m': ['N*m'],
  W: ['W', 'kW']
};

const FORMULA_VARIABLE_UNIT_GROUPS = {
  'F = m * a': { F: 'N', m: 'kg', a: 'm/s^2' },
  'v = u + a * t': { v: 'm/s', u: 'm/s', a: 'm/s^2', t: 's' },
  's = u * t + 0.5 * a * t^2': { s: 'm', u: 'm/s', t: 's', a: 'm/s^2' },
  'p * V = n * R * T': { p: 'Pa', V: 'm^3', n: 'mol', R: '', T: 'K' },
  'E = m * c^2': { E: 'J', m: 'kg', c: 'm/s' },
  'V = I * R': { V: 'V', I: 'A', R: 'ohm' },
  'KE = 0.5 * m * v^2': { KE: 'J', m: 'kg', v: 'm/s' },
  'W = F * d * cos(theta)': { W: 'J', F: 'N', d: 'm', theta: '' },
  'p = F / A': { p: 'Pa', F: 'N', A: 'm^2' },
  'tau = cross(r, F)': { tau: 'N*m', r: 'm', F: 'N' },
  'F = q * cross(v, B)': { F: 'N', q: 'C', v: 'm/s', B: 'T' },
  'F = k * q1 * q2 / r^2': { F: 'N', q1: 'C', q2: 'C', r: 'm' },
  'v = f * lambda': { v: 'm/s', f: 'Hz', lambda: 'm' },
  'P = W / t': { P: 'W', W: 'J', t: 's' },
  'p = m * v': { p: 'kg*m/s', m: 'kg', v: 'm/s' },
  'Q = m * c * dT': { Q: 'J', m: 'kg', c: '', dT: 'K' },
  'H = m * c * dT': { H: 'J', m: 'kg', c: '', dT: 'K' },
  'eta = 1 - Tc / Th': { eta: '', Tc: 'K', Th: 'K' },
  'Q = k * A * dT / L': { Q: 'W', k: 'W/mK', A: 'm^2', dT: 'K', L: 'm' },
  'Q = h * A * dT': { Q: 'W', h: 'W/m^2K', A: 'm^2', dT: 'K' },
  'P = rho * g * Q * H': { P: 'W', rho: 'kg/m^3', g: 'm/s^2', Q: 'm^3/s', H: 'm' },
  'W = P * dV': { W: 'J', P: 'Pa', dV: 'm^3' },
  'X_L = 2 * pi * f * L': { X_L: 'ohm', f: 'Hz', L: 'H' },
  'X_C = 1 / (2 * pi * f * C)': { X_C: 'ohm', f: 'Hz', C: 'F' },
  'A1 * v1 = A2 * v2': { A1: 'm^2', v1: 'm/s', A2: 'm^2', v2: 'm/s' },
  'h_f = f * L * v^2 / (2 * g * D)': { h_f: 'm', f: '', L: 'm', v: 'm/s', g: 'm/s^2', D: 'm' },
  'R_eq = R1 + R2': { R_eq: 'ohm', R1: 'ohm', R2: 'ohm' },
  'sigma = M * y / I': { sigma: 'Pa', M: 'N*m', y: 'm', I: 'm^4' },
  'E = m * g * h': { E: 'J', m: 'kg', g: 'm/s^2', h: 'm' },
  'P = V * I': { P: 'W', V: 'V', I: 'A' },
  'A = pi * r^2': { A: 'm^2', r: 'm' },
  'V = 4/3 * pi * r^3': { V: 'm^3', r: 'm' },
  'I = Q / t': { I: 'A', Q: 'C', t: 's' },
  'p = rho * g * h': { p: 'Pa', rho: 'kg/m^3', g: 'm/s^2', h: 'm' },
  'sigma = F / A': { sigma: 'Pa', F: 'N', A: 'm^2' },
  'epsilon = dL / L': { epsilon: '', dL: 'm', L: 'm' },
  'E = sigma / epsilon': { E: 'Pa', sigma: 'Pa', epsilon: '' },
  'Re = rho * v * d / mu': { Re: '', rho: 'kg/m^3', v: 'm/s', d: 'm', mu: 'Pa*s' },
  'Q = A * v': { Q: 'm^3/s', A: 'm^2', v: 'm/s' },
  'R = rho_r * L / A': { R: 'ohm', rho_r: 'ohm*m', L: 'm', A: 'm^2' },
  'y = F * L^3 / (3 * E * I2)': { y: 'm', F: 'N', L: 'm', E: 'Pa', I2: 'm^4' },
  'f = 1 / (2 * pi * sqrt(L * C))': { f: 'Hz', L: 'H', C: 'F' },
  'circ = 2 * pi * r': { circ: 'm', r: 'm' },
  'A = 0.5 * b * h': { A: 'm^2', b: 'm', h: 'm' },
  'S = n / 2 * (a1 + an)': { S: '', n: '', a1: '', an: '' },
  'x = (-b + sqrt(b^2 - 4 * a * c)) / (2 * a)': { x: '', a: '', b: '', c: '' },
  'F = q * E': { F: 'N', q: 'C', E: 'V/m' },
  'F = q * (E + cross(v, B))': { F: 'N', q: 'C', E: 'V/m', v: 'm/s', B: 'T' },
  'F = m * v^2 / r': { F: 'N', m: 'kg', v: 'm/s', r: 'm' },
  'L = I * w': { L: 'kg*m^2/s', I: 'A', w: 'Hz' },
  'KE = 0.5 * I * w^2': { KE: 'J', I: 'kg*m^2', w: 'Hz' },
  'F = k * x': { F: 'N', k: 'N/m', x: 'm' },
  'PE = 0.5 * k * x^2': { PE: 'J', k: 'N/m', x: 'm' },
  'T = 2 * pi * sqrt(m / k)': { T: 's', m: 'kg', k: 'N/m' },
  'eta = W / Qh': { eta: '', W: 'J', Qh: 'J' },
  'Q = 0.5 * C * V^2': { Q: 'J', C: 'F', V: 'V' },
  'Q = C * V': { Q: 'C', C: 'F', V: 'V' },
  'C = eps0 * A / d': { C: 'F', eps0: '', A: 'm^2', d: 'm' },
  'rho = m / V': { rho: 'kg/m^3', m: 'kg', V: 'm^3' },
  'Fb = rho * V * g': { Fb: 'N', rho: 'kg/m^3', V: 'm^3', g: 'm/s^2' },
  'P = I^2 * R': { P: 'W', I: 'A', R: 'ohm' },
  'E = V / d': { E: 'V/m', V: 'V', d: 'm' },
  'F = I * L * B': { F: 'N', I: 'A', L: 'm', B: 'T' },
  'B = mu0 * I / (2 * pi * r)': { B: 'T', mu0: '', I: 'A', r: 'm' },
  'E = 0.5 * L * I^2': { E: 'J', L: 'H', I: 'A' },
  'f = 1 / T': { f: 'Hz', T: 's' },
  'v = sqrt(2 * G * M / r)': { v: 'm/s', G: '', M: 'kg', r: 'm' },
  'F = G * m1 * m2 / r^2': { F: 'N', G: '', m1: 'kg', m2: 'kg', r: 'm' },
  '1/f = 1/do + 1/di': { f: 'Hz', do: 'm', di: 'm' },
  'm = -di / do': { m: '', di: 'm', do: 'm' },
  'n1 * sin(theta1) = n2 * sin(theta2)': { n1: '', theta1: '', n2: '', theta2: '' },
  'phi = B * A * cos(theta)': { phi: 'Wb', B: 'T', A: 'm^2', theta: '' },
  'y = m * x + b': { y: '', m: '', x: '', b: '' }
};

const UNIT_CONVERSIONS = {
  m: { km: 0.001, cm: 100, mm: 1000 },
  'm/s': { 'km/h': 3.6 },
  'm/s^2': { 'km/h^2': 12960 },
  'm^2': { 'cm^2': 10000 },
  'm^3': { L: 1000, 'cm^3': 1000000 },
  'm^3/s': { 'L/s': 1000 },
  'kg/m^3': { 'g/cm^3': 0.001 },
  'W/mK': {},
  'W/m^2K': {},
  H: {},
  F: {},
  'N/m': { 'kN/m': 0.001 },
  J: { kJ: 0.001, cal: 0.239005736, kcal: 0.000239005736 },
  N: { kN: 0.001 },
  Pa: { kPa: 0.001, bar: 1e-5 },
  V: { mV: 1000, kV: 0.001 },
  A: { mA: 1000, kA: 0.001 },
  ohm: { kohm: 0.001, Mohm: 0.000001 },
  s: { min: 1 / 60, h: 1 / 3600 },
  kg: { g: 1000, mg: 1000000 },
  C: { mC: 1000 },
  T: { mT: 1000 },
  Hz: { kHz: 0.001, MHz: 0.000001 },
  W: { kW: 0.001 }
};

function getUnitGroup(unit) {
  if (!unit) return null;
  const normalized = unit.trim();
  return Object.keys(UNIT_SETS).find((key) => UNIT_SETS[key].includes(normalized));
}

function convertUnit(value, fromUnit, toUnit) {
  if (!fromUnit || !toUnit || fromUnit === toUnit) return value;
  const group = getUnitGroup(fromUnit);
  if (!group) return value;
  const conversions = UNIT_CONVERSIONS[group] || {};

  // Convert from base unit to another unit
  if (fromUnit === group && conversions[toUnit] != null) {
    return value * conversions[toUnit];
  }

  // Convert from a derived unit back to base unit
  if (toUnit === group && conversions[fromUnit] != null && conversions[fromUnit] !== 0) {
    return value / conversions[fromUnit];
  }

  // Convert between two derived units through the base unit
  if (conversions[fromUnit] != null && conversions[toUnit] != null && conversions[fromUnit] !== 0) {
    const baseValue = value / conversions[fromUnit];
    return baseValue * conversions[toUnit];
  }

  // Fallback direct conversion if one of the units is not in the same group
  return value;
}

function getFormulaUnit(formulaText) {
  const formula = FREE_FORMULAS.find((item) => item.formula.trim().toLowerCase() === formulaText.trim().toLowerCase());
  return formula?.unit || suggestUnit(formulaText);
}

function getUnitGroupForVariable(name, formulaText) {
  const raw = name;
  const key = name.toLowerCase();
  if (raw === 'V') return 'V';
  if (raw === 'F') return 'N';
  if (/^(m|mass|m1|m2|mass1|mass2)$/.test(key)) return 'm';
  if (/^(v|u|velocity|speed|vel)$/.test(key)) return 'm/s';
  if (/^(a|accel|acceleration|ax|ay|az)$/.test(key)) return 'm/s^2';
  if (/^(t|time|dt|duration)$/.test(key)) return 's';
  if (/^(s|d|distance|displacement|x|y|z|r|radius)$/.test(key)) return 'm';
  if (/^(f|force|fn|fnet)$/i.test(key)) return 'N';
  if (/^(k|springconst|springconstant)$/i.test(key)) return 'N/m';
  if (/^(L|inductance)$/i.test(key) && /\bE\s*=\s*0\.5\s*\*\s*L\s*\*\s*I\^2\b/i.test(formulaText)) return 'H';
  if (/^(w|omega|angfreq)$/i.test(key)) return 'Hz';
  if (/^(phi)$/i.test(key)) return 'Wb';
  if (/^(power|pwr)$/i.test(key)) return 'W';
  if ((key === 'p' || key === 'pressure') && /\bW\s*\/\s*t\b/i.test(formulaText)) return 'W';
  if (/^(p|pressure)$/.test(key)) return 'Pa';
  if (/^(e|energy|ke|work|w)$/.test(key)) return 'J';
  return null;
}

function getBaseUnitForGroup(group) {
  if (!group) return '';
  return group;
}

function getFormulaPreset(formulaText) {
  return FREE_FORMULAS.find((item) => item.formula.trim().toLowerCase() === formulaText.trim().toLowerCase());
}

function getVariableUnitOptions(name, formulaText) {
  const preset = getFormulaPreset(formulaText);
  const presetGroups = preset ? FORMULA_VARIABLE_UNIT_GROUPS[preset.formula] : null;
  const group = presetGroups?.[name] || getUnitGroupForVariable(name, formulaText);
  const units = new Set(['']);
  if (group && UNIT_SETS[group]) {
    UNIT_SETS[group].forEach((u) => units.add(u));
  } else {
    Object.values(UNIT_SETS).flat().forEach((u) => units.add(u));
  }
  return [...units];
}

function getVariableUnitHint(name, formulaText) {
  const preset = getFormulaPreset(formulaText);
  const presetGroups = preset ? FORMULA_VARIABLE_UNIT_GROUPS[preset.formula] : null;
  const group = presetGroups?.[name] || getUnitGroupForVariable(name, formulaText);
  if (!group) return '';
  const options = UNIT_SETS[group] || [];
  return options.length ? `units: ${options.join('/')}` : '';
}

function getRelevantConstants(formulaText) {
  const names = Object.keys(CONSTANTS);
  const rhs = formulaText.includes('=') ? formulaText.split('=')[1].trim() : formulaText;
  return names.filter((name) => {
    const regex = new RegExp(`\\b${name}\\b`, 'g');
    return regex.test(rhs);
  });
}

function updateConstantsForFormula(formulaText) {
  const constantsButton = document.getElementById('free-show-constants');
  const constantsPanel = document.getElementById('free-constants-panel');
  if (!constantsButton || !constantsPanel) return;

  const relevant = getRelevantConstants(formulaText);
  if (relevant.length === 0) {
    constantsButton.style.display = 'none';
    constantsPanel.style.display = 'none';
    constantsPanel.innerText = '';
    constantsButton.innerText = 'Show constants';
    return;
  }

  constantsButton.style.display = 'inline-flex';
  constantsButton.innerText = 'Show constants';
  constantsPanel.innerText = relevant.map((name) => `${name} = ${CONSTANTS[name]}`).join('\n');
  if (constantsPanel.style.display === 'block') {
    constantsPanel.style.display = 'block';
  }
}

function buildInputScope(formula) {
  const vars = extractVariables(formula);
  const scope = {};
  const details = [];

  vars.forEach((name) => {
    const input = document.getElementById(`free-${name}`);
    if (!input) return;
    const value = parseVariableValue(input.value);
    const unit = getVariableUnit(name);
    let convertedValue = value;
    let conversionNote = '';
    const group = getUnitGroup(unit);
    const baseUnit = group ? getBaseUnitForGroup(group) : unit;

    const invalidUnit = Boolean(unit && !group);
    if (typeof value === 'number' && unit && baseUnit && group) {
      convertedValue = convertUnit(value, unit, baseUnit);
      if (unit !== baseUnit) {
        conversionNote = `${value} ${unit} → ${convertedValue} ${baseUnit}`;
      }
    }

    if (invalidUnit) {
      convertedValue = value;
    }

    if (convertedValue !== '' && convertedValue !== null && convertedValue !== undefined) {
      scope[name] = convertedValue;
    }

    details.push({
      name,
      rawValue: value,
      unit,
      convertedValue,
      baseUnit,
      conversionNote,
      invalidUnit
    });
  });

  Object.entries(CONSTANTS).forEach(([name, value]) => {
    if (scope[name] === undefined) {
      scope[name] = value;
    }
  });

  return { scope, details };
}

function suggestUnit(formulaText) {
  const lower = (formulaText || '').toLowerCase();
  if (/force|f\s*=\s*m/i.test(lower)) return 'N';
  if (/velocity|v\s*=\s*u/i.test(lower)) return 'm/s';
  if (/distance|s\s*=\s*u/i.test(lower)) return 'm';
  if (/energy|e\s*=\s*m/i.test(lower)) return 'J';
  if (/pressure|p\s*=\s*f/i.test(lower)) return 'Pa';
  return '';
}

function formatSubstitution(expression, scope) {
  let substituted = expression;
  Object.entries(scope).forEach(([name, value]) => {
    substituted = substituted.replace(new RegExp(`\\b${name}\\b`, 'g'), `(${value})`);
  });
  return substituted;
}

function parseVariableValue(raw) {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      return math.evaluate(trimmed);
    } catch {
      return trimmed;
    }
  }
  const numeric = parseFloat(trimmed);
  return Number.isNaN(numeric) ? trimmed : numeric;
}

function isVectorFormula(formula) {
  return /\[.*\]/.test(formula) || /cross\s*\(/i.test(formula) || /dot\s*\(/i.test(formula);
}

function getVariableUnit(name) {
  const unitInput = document.getElementById(`free-unit-${name}`);
  return unitInput?.value.trim() || '';
}

function formatValueWithUnit(name, value) {
  const unit = getVariableUnit(name);
  return `${value}${unit ? ` ${unit}` : ''}`;
}

function extractVariables(formula) {
  const vars = formula.match(/[a-zA-Z][a-zA-Z0-9_]*/g) || [];
  return [...new Set(vars)].filter((v) => {
    const lower = v.toLowerCase();
    return !FUNCTION_NAMES.has(lower) && !CONSTANT_NAMES.has(v);
  });
}

function solveUnknownVariable(equation, target, scope) {
  const equationNode = math.parse(`(${equation})`);
  const compiled = equationNode.compile();

  const fn = (value) => {
    const localScope = { ...scope, [target]: value };
    const result = compiled.evaluate(localScope);
    if (typeof result !== 'number' || Number.isNaN(result) || !Number.isFinite(result)) {
      throw new Error('Invalid numeric evaluation');
    }
    return result;
  };

  let derivative;
  try {
    derivative = math.derivative(equationNode, target).compile();
  } catch {
    derivative = null;
  }

  const evaluateF = (x) => fn(x);
  const evaluateFprime = (x) => derivative ? derivative.evaluate({ ...scope, [target]: x }) : null;

  let guess = 1;
  if (scope[target] !== undefined) guess = scope[target];
  let value = guess;
  for (let i = 0; i < 25; i += 1) {
    const f = evaluateF(value);
    const fp = evaluateFprime(value);
    if (Math.abs(f) < 1e-9) return value;
    if (fp !== null && Math.abs(fp) > 1e-12) {
      const next = value - f / fp;
      if (!Number.isFinite(next)) break;
      value = next;
      continue;
    }
    break;
  }

  let lower = -1000;
  let upper = 1000;
  let fa = evaluateF(lower);
  let fb = evaluateF(upper);
  if (Math.sign(fa) === Math.sign(fb)) {
    for (let shift = 1; shift <= 5; shift += 1) {
      lower *= 10;
      upper *= 10;
      fa = evaluateF(lower);
      fb = evaluateF(upper);
      if (Math.sign(fa) !== Math.sign(fb)) break;
    }
  }

  if (Math.sign(fa) === Math.sign(fb)) {
    throw new Error('Could not locate a sign change for the unknown variable. Provide more information or try a different formula.');
  }

  for (let i = 0; i < 50; i += 1) {
    const mid = (lower + upper) / 2;
    const fm = evaluateF(mid);
    if (Math.abs(fm) < 1e-9) return mid;
    if (Math.sign(fm) === Math.sign(fa)) {
      lower = mid;
      fa = fm;
    } else {
      upper = mid;
      fb = fm;
    }
  }

  return (lower + upper) / 2;
}

function updateUnitOptions(formula) {
  const unitSelect = document.getElementById('free-unit');
  if (!unitSelect) return;
  const formulaUnit = getFormulaUnit(formula);
  const group = getUnitGroup(formulaUnit);
  const options = group ? UNIT_SETS[group] : [formulaUnit, ''];
  unitSelect.innerHTML = [...new Set(['', ...(options || [])])].map((unit) => {
    const label = unit === '' ? 'Auto' : unit;
    return `<option value="${unit}">${label}</option>`;
  }).join('');
}

function updateSolveTargetOptions(formula) {
  const targetSelect = document.getElementById('free-solve-target');
  if (!targetSelect) return;
  const vars = extractVariables(formula);
  const { scope } = buildInputScope(formula);
  const unknowns = vars.filter((name) => scope[name] === undefined);
  const options = unknowns.length > 0 ? unknowns : vars;
  targetSelect.innerHTML = options.map((name) => `<option value="${name}">${name}</option>`).join('');
}

function generateFreeInputBoxes(formula) {
  updateUnitOptions(formula);
  const vars = extractVariables(formula);
  const { scope } = buildInputScope(formula);
  const inputsDiv = document.getElementById('free-inputs');
  if (!inputsDiv) return;
  const vectorMode = isVectorFormula(formula);
  inputsDiv.innerHTML = vars.map((name) => {
    const value = scope[name] !== undefined ? scope[name] : '';
    const unitOptions = getVariableUnitOptions(name, formula);
    return `
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:8px;">
        <label style="width:60px; font-weight:600;">${name}:</label>
        <input type="${vectorMode ? 'text' : 'number'}" id="free-${name}" value="${value}" placeholder="${vectorMode ? `${name} = [1,2,3]` : `${name} = ?`}${getVariableUnitHint(name, formula) ? ` (${getVariableUnitHint(name, formula)})` : ''}" style="width:140px; padding:6px; border-radius:8px; border:1px solid #c3bff7;" />
        <select id="free-unit-${name}" style="width:90px; padding:6px; border-radius:8px; border:1px solid #c3bff7;">
          ${unitOptions.map((unit) => `<option value="${unit}">${unit === '' ? 'Auto' : unit}</option>`).join('')}
        </select>
      </div>
    `;
  }).join('');
  updateSolveTargetOptions(formula);
}

function renderFreeCalculator() {
  if (!freeCalculator) return;
  freeCalculator.innerHTML = `
    <div class="free-calculator-box">
      <p>Pick any formula, pick a target variable, and enter values for the others.</p>
      <div class="free-row">
        <label>Formula library:</label>
        <select id="free-formula-library" class="free-select"></select>
      </div>
      <input type="text" id="free-formula" class="free-input" placeholder="e.g: F = m * a" />
      <div class="free-row">
        <label for="free-solve-target">Solve for:</label>
        <select id="free-solve-target" class="free-select"></select>
      </div>
      <div id="free-inputs" class="free-inputs"></div>
      <div class="free-row">
        <label for="free-unit">Result unit:</label>
        <select id="free-unit" class="free-select"></select>
        <button type="button" id="free-show-constants" class="free-small-btn">Show constants</button>
      </div>
      <div id="free-constants-panel" class="free-constants-panel" style="display:none; white-space:pre-wrap; margin:8px 0; padding:10px; border:1px solid #c3bff7; border-radius:10px; background:#f8f3ff; color:#3c2d66;"></div>
      <div class="free-row free-row-inline">
        <button type="button" id="free-copy-result" class="free-secondary-btn">Copy result</button>
      </div>
      <button type="button" id="free-solve" class="free-primary-btn">Solve</button>
      <div style="margin-top: 10px;">
        <section id="calculatorSponsoredAdSection" style="display: none;">
          <div style="font-size: 0.85rem; font-weight: 600; color: #667eea; margin-bottom: 0.4rem;">Sponsored</div>
          <div id="container-12047c86afca4fe3c32cea7613361946-calculator"></div>
        </section>
      </div>
      <script async="async" data-cfasync="false" src="https://sidewalkboiling.com/12047c86afca4fe3c32cea7613361946/invoke.js"></script>
      <script>
        (function () {
          const section = document.getElementById('calculatorSponsoredAdSection');
          const container = document.getElementById('container-12047c86afca4fe3c32cea7613361946-calculator');

          function updateVisibility() {
            if (!section || !container) return;
            const hasContent = container.innerHTML.trim() !== '' || container.querySelector('iframe, ins, img, a') !== null;
            section.style.display = hasContent ? 'block' : 'none';
          }

          if (section && container) {
            updateVisibility();
            const observer = new MutationObserver(updateVisibility);
            observer.observe(container, { childList: true, subtree: true, characterData: true });
            window.setTimeout(updateVisibility, 1000);
            window.setTimeout(updateVisibility, 3000);
          }
        })();
      </script>
      <div id="free-explanation" class="free-explanation"></div>
      <p id="free-step" class="free-step"></p>
      <p id="free-result" class="free-result"></p>
    </div>
  `;

  const formulaInput = document.getElementById('free-formula');
  const formulaLibrary = document.getElementById('free-formula-library');
  const solveBtn = document.getElementById('free-solve');

  if (formulaLibrary) {
    formulaLibrary.innerHTML = FREE_FORMULAS.map((item, index) => `<option value="${item.formula}">${item.name}</option>`).join('');
    formulaLibrary.addEventListener('change', () => {
      if (!formulaInput) return;
      formulaInput.value = formulaLibrary.value;
      generateFreeInputBoxes(formulaLibrary.value);
      updateUnitOptions(formulaLibrary.value);
      updateConstantsForFormula(formulaLibrary.value);
      const copyButton = document.getElementById('free-copy-result');
      if (copyButton) copyButton.style.display = 'none';
    });
    formulaLibrary.selectedIndex = 0;
  }

  if (formulaInput) {
    formulaInput.addEventListener('input', () => {
      const formulaValue = formulaInput.value.trim();
      generateFreeInputBoxes(formulaValue);
      updateUnitOptions(formulaValue);
      updateConstantsForFormula(formulaValue);
      const copyButton = document.getElementById('free-copy-result');
      if (copyButton) copyButton.style.display = 'none';
    });
    formulaInput.value = FREE_FORMULAS[0].formula;
  }

  const constantsButton = document.getElementById('free-show-constants');
  const constantsPanel = document.getElementById('free-constants-panel');
  if (constantsButton && constantsPanel) {
    constantsButton.addEventListener('click', () => {
      const visible = constantsPanel.style.display === 'block';
      if (visible) {
        constantsPanel.style.display = 'none';
        constantsButton.innerText = 'Show constants';
      } else {
        updateConstantsForFormula(formulaInput?.value || '');
        constantsPanel.style.display = 'block';
        constantsButton.innerText = 'Hide constants';
      }
    });
  }

  const copyButton = document.getElementById('free-copy-result');
  const explanationPanel = document.getElementById('free-explanation');

  if (copyButton) {
    copyButton.style.display = 'none';
    copyButton.addEventListener('click', () => {
      const resultText = document.getElementById('free-result')?.innerText || '';
      if (!resultText) return;
      navigator.clipboard.writeText(resultText).then(() => {
        explanationPanel.style.display = 'block';
        explanationPanel.innerText = 'Result copied to clipboard.';
      }).catch(() => {
        explanationPanel.style.display = 'block';
        explanationPanel.innerText = 'Unable to copy result. Please copy manually.';
      });
    });
  }

  if (solveBtn) {
    solveBtn.addEventListener('click', () => solveFreeFormula());
  }

  updateUnitOptions(formulaInput?.value || '');
  generateFreeInputBoxes(formulaInput?.value || '');
  updateConstantsForFormula(formulaInput?.value || '');
}

function solveFreeFormula() {
  const formulaInput = document.getElementById('free-formula');
  const resultP = document.getElementById('free-result');
  const stepP = document.getElementById('free-step');
  const unitSelect = document.getElementById('free-unit');
  const targetSelect = document.getElementById('free-solve-target');
  if (!formulaInput || !resultP || !stepP || !targetSelect) return;

  const formulaText = formulaInput.value.trim();
  if (!formulaText) {
    resultP.innerText = 'Enter a formula first.';
    resultP.style.color = 'red';
    stepP.innerText = '';
    return;
  }

  const [left, right] = formulaText.includes('=')
    ? formulaText.split('=').map((s) => s.trim())
    : [null, formulaText];

  const explanationPanel = document.getElementById('free-explanation');
  const targetVariable = targetSelect.value || null;
  const allVars = extractVariables(formulaText);
  const inputScope = buildInputScope(formulaText);
  const scope = inputScope.scope;
  const conversionDetails = inputScope.details || [];
  const conversions = conversionDetails
    .filter((d) => d.conversionNote)
    .map((d) => `${d.name}: ${d.conversionNote}`)
    .join('\n');
  const hasConversions = conversions.length > 0;
  const conversionStep = hasConversions
    ? `Step 1: Convert input units to base units\n${conversions}\n\n`
    : '';
  const startStep = hasConversions ? 2 : 1;
  const stepLabel = (n) => `Step ${n + startStep - 1}: `;
  const unknowns = allVars.filter((name) => scope[name] === undefined && name !== targetVariable);
  const invalidUnits = conversionDetails.filter((d) => d.unit && !getUnitGroup(d.unit) && d.rawValue !== '' && d.rawValue !== null && d.rawValue !== undefined);
  if (invalidUnits.length > 0) {
    resultP.innerText = `Invalid unit selected for: ${invalidUnits.map((d) => d.name).join(', ')}.`;
    resultP.style.color = 'red';
    stepP.innerText = '';
    if (explanationPanel) {
      explanationPanel.style.display = 'block';
      explanationPanel.innerText = `Please select valid units for: ${invalidUnits.map((d) => d.name).join(', ')}.`;
    }
    return;
  }

  if (left && unknowns.length > 0) {
    resultP.innerText = `Provide values for: ${unknowns.join(', ')} or choose a different target.`;
    resultP.style.color = 'red';
    stepP.innerText = '';
    if (explanationPanel) {
      explanationPanel.style.display = 'block';
      explanationPanel.innerText = `Missing inputs: ${unknowns.join(', ')}.`;
    }
    return;
  }

  try {
    let result;
    let solvedTarget = targetVariable;
    const suggestedUnit = suggestUnit(formulaText);
    const selectedUnit = unitSelect?.value || '';
    const unitLabel = selectedUnit || suggestedUnit ? ` ${selectedUnit || suggestedUnit}` : '';

    if (left) {
      const equation = `${left} - (${right})`;
      if (!solvedTarget) {
        const vars = extractVariables(formulaText);
        const remaining = vars.filter((name) => scope[name] === undefined);
        if (remaining.length === 1) solvedTarget = remaining[0];
      }

      if (!solvedTarget) {
        const leftVal = math.evaluate(left, scope);
        const rightVal = math.evaluate(right, scope);
        stepP.innerText = `${conversionStep}${stepLabel(1)}Parse formula\n${left} = ${right}\n\n${stepLabel(2)}Substitute values\n${left} = ${formatSubstitution(left, scope)}\n${right} = ${formatSubstitution(right, scope)}\n\n${stepLabel(3)}Evaluate\n${left} = ${leftVal}\n${right} = ${rightVal}`;
        if (Math.abs(leftVal - rightVal) < 1e-9) {
          resultP.innerText = `True ✓ Both sides equal ${leftVal}${unitLabel}`;
          resultP.style.color = 'green';
        } else {
          resultP.innerText = `False ✗ ${leftVal}${unitLabel} ≠ ${rightVal}${unitLabel}`;
          resultP.style.color = 'orange';
        }
        return;
      }

      const rawSubLeft = formatSubstitution(left, scope);
      const rawSubRight = formatSubstitution(right, scope);
      const solvedEquation = `${rawSubLeft} = ${rawSubRight}`;
      const solverInput = `${left} - (${right})`;
      const solvedValue = solveUnknownVariable(solverInput, solvedTarget, scope);
      const formulaUnit = getFormulaUnit(formulaText);
      const convertedValue = selectedUnit && formulaUnit ? convertUnit(solvedValue, formulaUnit, selectedUnit) : solvedValue;
      const displayUnit = selectedUnit || formulaUnit || '';
      result = `${solvedTarget} = ${convertedValue}${displayUnit ? ` ${displayUnit}` : ''}`;
      stepP.innerText = `${conversionStep}${stepLabel(1)}Parse formula\n${left} = ${right}\n\n${stepLabel(2)}Substitute known values\n${solvedEquation}\n\n${stepLabel(3)}Solve for ${solvedTarget}\n${solvedTarget} = ${solvedValue}${formulaUnit ? ` ${formulaUnit}` : ''}`;
      if (displayUnit && displayUnit !== formulaUnit) {
        stepP.innerText += `\n\n${stepLabel(4)}Convert from ${formulaUnit || 'base unit'} to ${displayUnit}`;
      }
      resultP.innerText = result;
      resultP.style.color = 'green';
      if (explanationPanel) {
        explanationPanel.style.display = 'block';
        explanationPanel.innerText = `Formula: ${formulaText}\nTarget: ${solvedTarget}\nComputed: ${result}\nUnits used: ${displayUnit || 'auto'}\nVector mode: ${isVectorFormula(formulaText) ? 'yes' : 'no'}`;
      }
      const copyButton = document.getElementById('free-copy-result');
      if (copyButton) copyButton.style.display = 'inline-flex';
      return;
    }

    const expr = right;
    result = math.evaluate(expr, scope);
    stepP.innerText = `${conversionStep}${stepLabel(1)}Parse expression
${expr}

${stepLabel(2)}Substitute values
${formatSubstitution(expr, scope)}

${stepLabel(3)}Evaluate
${result}${unitLabel}`;
    resultP.innerText = `${result}${unitLabel}`;
    resultP.style.color = 'green';
    if (explanationPanel) {
      explanationPanel.style.display = 'block';
      explanationPanel.innerText = `Expression: ${expr}\nResult: ${result}${unitLabel}\nVector mode: ${isVectorFormula(formulaText) ? 'yes' : 'no'}`;
    }
  } catch (error) {
    console.error(error);
    resultP.innerText = 'Error: Could not solve this formula. Check the syntax and variable values.';
    resultP.style.color = 'red';
    stepP.innerText = '';
    if (explanationPanel) {
      explanationPanel.style.display = 'block';
      explanationPanel.innerText = `Error: ${error.message}`;
    }
  }
}

// Layout-aware text extraction: group text items by their vertical position
function extractTextWithLayout(textContent) {
    if (!textContent || !textContent.items || textContent.items.length === 0) return '';

    const items = textContent.items.map((item) => {
      const t = item.transform || [];
      const x = typeof t[4] === 'number' ? t[4] : 0;
      const y = typeof t[5] === 'number' ? t[5] : 0;
      return { str: item.str || '', x, y };
    });

    // Group by rounded Y to form rows, then sort rows top-to-bottom and items left-to-right
    const rows = new Map();
    items.forEach((it) => {
      const yKey = Math.round(it.y);
      if (!rows.has(yKey)) rows.set(yKey, []);
      rows.get(yKey).push(it);
    });

    const sortedYs = Array.from(rows.keys()).sort((a, b) => b - a);
    const lines = sortedYs.map((y) => {
      const row = rows.get(y) || [];
      row.sort((a, b) => a.x - b.x);
      return row.map(r => r.str).join(' ');
    }).filter(Boolean);

    const text = lines.join('\n');
    if (text.trim().length === 0) {
      // fallback to simple join
      return textContent.items.map((it) => it.str).join(' ');
    }
    return text;
  }

// SMART QUESTIONS - UNIQUE PER PAGE
function generateSmartQuestions(text) {
  const questions = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

  // Q1: If there's a definition
  const def = sentences.find(s => /is defined as|known as|called/i.test(s));
  if(def) questions.push(`According to the text, ${def.split('is')[0].trim()} is defined as what?`);

  // Q2: If there's a formula
  const formula = text.match(/Γ\([^)]+\)\s*=\s*[^.]+/);
  if(formula) questions.push(`Write the formula for ${formula[0].split('=')[0].trim()}`);

  // Q3: If there's a property/list
  if(/property|properties/i.test(text)) questions.push("List 2 properties of the Gamma function mentioned here.");

  // Q4: If there's a name
  if(/Euler/i.test(text)) questions.push("Who first introduced the Gamma function?");

  // Fallback if nothing found
  if(questions.length === 0) questions.push("What is the main idea discussed on this page?");

  return [...new Set(questions)].slice(0,3); // remove duplicates
}

const renderPageResult = (pageResult) => {
  if (summarySection) {
    summarySection.classList.remove('hidden');
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'page-result';
  wrapper.innerHTML = `
    <h3>Page ${pageResult.page}</h3>
    <p><strong>Summary:</strong> ${pageResult.summary || 'No text found on this page.'}</p>
  `;
  output.appendChild(wrapper);
};

const generatePageSummary = async (pageText, pageIndex) => {
  const cleanText = pageText
    .replace(/^\d+\s*|\s*\d+\s*$/g, '')
    .replace(/�|□|_/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanText.length < 30) {
    return {
      page: pageIndex + 1,
      summary: 'This page could not be read. It may be a scanned image.',
      rawText: pageText
    };
  }

  const pdfSummary = extractTopSentences(cleanText, 2).join(' ');
  const topicMatch = cleanText.match(/\b(Gamma function|Beta function|Integral|Derivative|Matrix)\b/i);
  const topic = topicMatch ? topicMatch[0] : null;
  let wikiSummary = null;

  if (topic) {
    wikiSummary = await getWikipediaSummary(topic);
  }

  let finalSummary = pdfSummary;
  if (wikiSummary && pdfSummary.length < 200) {
    finalSummary = `${pdfSummary} \n\nFrom Wikipedia: ${wikiSummary}`;
  }

  return {
    page: pageIndex + 1,
    summary: finalSummary,
    rawText: cleanText,
  };
};

const getFilesFromEvent = (event) => {
  if (event?.target?.files?.length) {
    return event.target.files;
  }
  if (event?.dataTransfer?.files?.length) {
    return event.dataTransfer.files;
  }
  if (event?.dataTransfer?.items?.length) {
    return Array.from(event.dataTransfer.items)
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter(Boolean);
  }
  return [];
};

const handleFile = async (event) => {
  const files = getFilesFromEvent(event);
  const file = files?.[0];

  if (!file) {
    updateStatus('No file selected. Please choose a PDF to summarize.');
    fileName.textContent = '';
    return;
  }

  selectedFile = file;
  fileName.textContent = `Loaded file: ${file.name}`;
  updateStatus('Preparing your summary... please wait.', true);
  showProgress();
  progressFill.style.width = '0%';
  output.innerHTML = '';
  if (summarySection) {
    summarySection.classList.add('hidden');
  }
  if (resultBox) {
    resultBox.classList.add('hidden');
    resultBox.style.display = 'none';
  }

  try {
    // Use pdf.js to extract text from PDF pages in-browser
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages || 0;
    totalPages.innerText = pageCount;

    if (pageCount === 0) {
      updateStatus('Unable to read the document. Please try a different PDF.');
      hideProgress();
      return;
    }

    const pages = [];
    for (let i = 1; i <= pageCount; i++) {
      pageNum.innerText = i;
      const progress = Math.round((i / pageCount) * 100);
      progressFill.style.width = `${progress}%`;
      updateStatus(`Extracting text from page ${i} of ${pageCount}...`);

      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent({ normalizeWhitespace: false });
      const pageText = extractTextWithLayout(textContent);
      pages.push(pageText || '');
    }

    // Identify unsupported (likely scanned) pages
    const unsupportedPages = pages
      .map((t, idx) => (t.trim().length < 30 ? idx + 1 : null))
      .filter(Boolean);

    if (unsupportedPages.length === pages.length) {
      // All pages unsupported -> show single message
      const wrapper = document.createElement('div');
      wrapper.className = 'page-result';
      wrapper.innerHTML = `
        <h3>No readable pages</h3>
        <p>All pages appear to be scanned images and could not be read. Try uploading a text-based PDF (for example, export from Word or Google Docs).</p>
      `;
      output.appendChild(wrapper);
      updateStatus('This file appears to contain scanned pages only. Try a text-based PDF.');
      hideProgress();
      return;
    }

    if (unsupportedPages.length > 0) {
      // Show one consolidated notice for skipped pages
      const wrapper = document.createElement('div');
      wrapper.className = 'page-result';
      wrapper.innerHTML = `
        <h3>Some pages could not be read</h3>
        <p>The following pages appear to be scanned images and were skipped: ${unsupportedPages.join(', ')}. Try uploading a text-based PDF (export from Word or Google Docs) to extract selectable text.</p>
      `;
      output.appendChild(wrapper);
    }

    const summaries = [];
    for (let index = 0; index < pages.length; index++) {
      const pageIndex = index + 1;
      const pageText = pages[index];
      if (pageText.trim().length < 30) continue;

      pageNum.innerText = pageIndex;
      const progress = Math.round((pageIndex / Math.max(pageCount, pages.length)) * 100);
      progressFill.style.width = `${progress}%`;
      updateStatus(`Summarizing page ${pageIndex} of ${Math.max(pageCount, pages.length)}...`);

      const pageResult = await generatePageSummary(pageText, pageIndex);
      pageResult.rawText = pageText || 'No extracted text found.';
      summaries.push(pageResult);
      renderPageResult(pageResult);
    }

    if (resultBox) {
      resultBox.dataset.summary = JSON.stringify(summaries);
      resultBox.classList.remove('hidden');
      resultBox.style.display = 'block';
    }
    updateStatus('Your study summary is ready.');
    handleSummaryComplete();
  } catch (error) {
    console.error(error);
    updateStatus(error.message || 'Something went wrong while processing the PDF. Please try again.');
  } finally {
    hideProgress();
  }
};

const sanitizePdfTextSafe = (text) => {
  if (!text) return '';
  return text
    .normalize('NFKD')
    .replace(/[^\t\n\r -~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const downloadSummaryPdf = () => {
  const data = resultBox.dataset.summary ? JSON.parse(resultBox.dataset.summary) : [];
  if (data.length === 0) {
    updateStatus('There is no summary to download yet. Generate one first.');
    return;
  }

  const doc = new jsPDF();
  let y = 25;

  const applyWatermark = () => {
    doc.setTextColor(210, 210, 210);
    doc.setFontSize(32);
    doc.text('StudyGrind', 105, 150, { align: 'center', angle: 45 });
    doc.setTextColor(0, 0, 0);
  };

  applyWatermark();
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  const titleText = sanitizePdfTextSafe('StudyGrind PDF Summary');
  doc.text(titleText, 20, y);
  y += 12;
  doc.setFontSize(11);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(90, 90, 110);
  doc.text('A clean study summary generated from your PDF.', 20, y);
  y += 16;
  doc.setTextColor(0, 0, 0);

  data.forEach((pageResult) => {
    if (y > 250) {
      doc.addPage();
      applyWatermark();
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      y = 20;
    }

    doc.setFontSize(13);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Page ${pageResult.page}`, 20, y);
    y += 8;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    const rawSummary = `Summary: ${pageResult.summary}`;
    const formattedSummary = sanitizePdfTextSafe(rawSummary)
      .replace(/From Wikipedia:/gi, '\n\nFrom Wikipedia:');
    const summaryLines = doc.splitTextToSize(formattedSummary || 'Summary: text unavailable.', 170);
    doc.text(summaryLines, 20, y);
    y += summaryLines.length * 6 + 10;
  });

  doc.save('StudyGrind_PDF_Summary.pdf');
};

if (pdfInput) {
  pdfInput.addEventListener('change', (event) => {
    const file = getFilesFromEvent(event)[0];
    selectedFile = file || null;
    if (selectedFile) {
      fileName.textContent = `Selected file: ${selectedFile.name}`;
      hideProgress();
      updateStatus('Ready to summarize. Click Generate Summary when you are ready.');
    } else {
      fileName.textContent = '';
      hideProgress();
      updateStatus('Please select a PDF to continue.');
    }
  });
}

// Render the free calculator immediately so students can use it without a PDF
renderFreeCalculator();

const tabSummary = document.getElementById('tabSummary');
const tabCalculator = document.getElementById('tabCalculator');
const summaryTab = document.getElementById('summaryTab');
const calculatorTab = document.getElementById('calculatorTab');

const activateTab = (tabName) => {
  const summaryActive = tabName === 'summary';
  tabSummary?.classList.toggle('active', summaryActive);
  tabCalculator?.classList.toggle('active', !summaryActive);
  summaryTab?.classList.toggle('active', summaryActive);
  calculatorTab?.classList.toggle('active', !summaryActive);
};

if (tabSummary) {
  const activateSummary = () => activateTab('summary');
  tabSummary.addEventListener('click', activateSummary);
  tabSummary.addEventListener('touchend', (e) => {
    e.preventDefault();
    activateSummary();
  });
  tabSummary.addEventListener('pointerdown', (e) => {
    e.preventDefault();
  });
}

if (tabCalculator) {
  const activateCalculator = () => activateTab('calculator');
  tabCalculator.addEventListener('click', activateCalculator);
  tabCalculator.addEventListener('touchend', (e) => {
    e.preventDefault();
    activateCalculator();
  });
  tabCalculator.addEventListener('pointerdown', (e) => {
    e.preventDefault();
  });
}

if (dropZone) {
  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragover');
    const files = getFilesFromEvent(event);
    const file = files?.[0];
    if (file) {
      selectedFile = file;
      fileName.textContent = `Selected file: ${selectedFile.name}`;
      hideProgress();
      updateStatus('Ready to summarize. Click Generate Summary when you are ready.');
    }
  });
}

if (summarizeButton) {
  summarizeButton.addEventListener('click', () => {
    if (!selectedFile) {
      updateStatus('Please select a PDF to continue.');
      return;
    }
    handleFile({ target: { files: [selectedFile] } });
  });
}

// No-op on load; app is ready to use with local pdf.js

if (downloadBtn) {
  downloadBtn.addEventListener('click', downloadSummaryPdf);
}




