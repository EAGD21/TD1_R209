/* ── Éléments DOM ── */
const cpInput    = document.getElementById('codePostal');
const communeSel = document.getElementById('commune');
const searchBtn  = document.getElementById('searchBtn');
const loader     = document.getElementById('loader');
const errorMsg   = document.getElementById('errorMsg');
const result     = document.getElementById('result');
const resultCity = document.getElementById('resultCity');
const resultDate = document.getElementById('resultDate');
const metrics    = document.getElementById('metrics');

/* ── Stockage des coordonnées de la commune sélectionnée ── */
let communeCoords = null; // { lat, lon }

/* ── Utilitaires ── */
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('visible');
  result.classList.remove('visible');
  loader.classList.remove('visible');
}

function clearError() {
  errorMsg.classList.remove('visible');
  errorMsg.textContent = '';
}

function setLoader(on) {
  loader.classList.toggle('visible', on);
}

/* ── 1. Chargement des communes par code postal ── */
let debounceTimer;

cpInput.addEventListener('input', () => {
  clearError();
  communeSel.disabled = true;
  communeSel.innerHTML = '<option value="">Chargement…</option>';
  searchBtn.disabled = true;
  communeCoords = null;

  const cp = cpInput.value.trim();

  if (!/^\d{5}$/.test(cp)) {
    communeSel.innerHTML = '<option value="">— saisissez d\'abord un code postal —</option>';
    return;
  }

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchCommunes(cp), 400);
});

async function fetchCommunes(cp) {
  try {
    const res = await fetch(
      `https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom,code,centre&format=json`
    );

    if (!res.ok) throw new Error('Erreur réseau');

    const data = await res.json();

    if (!data.length) {
      communeSel.innerHTML = '<option value="">Aucune commune trouvée</option>';
      return;
    }

    communeSel.innerHTML = '<option value="">— choisissez une commune —</option>';
    data.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.code;
      opt.textContent = c.nom;
      if (c.centre && c.centre.coordinates) {
        opt.dataset.lat = c.centre.coordinates[1];
        opt.dataset.lon = c.centre.coordinates[0];
      }
      communeSel.appendChild(opt);
    });

    communeSel.disabled = false;
  } catch (e) {
    showError('Impossible de récupérer les communes. Vérifiez votre connexion.');
  }
}

/* ── 2. Activation du bouton quand une commune est choisie ── */
communeSel.addEventListener('change', () => {
  const selected = communeSel.options[communeSel.selectedIndex];
  if (communeSel.value && selected.dataset.lat) {
    communeCoords = { lat: selected.dataset.lat, lon: selected.dataset.lon };
    searchBtn.disabled = false;
  } else {
    communeCoords = null;
    searchBtn.disabled = true;
  }
  clearError();
});

/* ── 3. Récupération météo via Open-Meteo ── */
searchBtn.addEventListener('click', async () => {
  const communeName = communeSel.options[communeSel.selectedIndex].text;

  if (!communeCoords) { showError('Coordonnées de la commune introuvables.'); return; }

  clearError();
  setLoader(true);
  result.classList.remove('visible');

  try {
    const url = `https://api.open-meteo.com/v1/forecast`
      + `?latitude=${communeCoords.lat}`
      + `&longitude=${communeCoords.lon}`
      + `&daily=temperature_2m_min,temperature_2m_max,precipitation_probability_max,sunshine_duration`
      + `&timezone=Europe%2FParis`
      + `&forecast_days=1`;

    const res = await fetch(url);

    if (!res.ok) throw new Error(`Erreur API météo (${res.status}).`);

    const data = await res.json();
    const d = data.daily;

    if (!d) throw new Error('Données météo indisponibles pour cette commune.');

    // sunshine_duration est en secondes → conversion en heures
    const sunHours = d.sunshine_duration?.[0] !== undefined
      ? Math.round(d.sunshine_duration[0] / 3600 * 10) / 10
      : null;

    const forecast = {
      tmin:     d.temperature_2m_min?.[0]            ?? null,
      tmax:     d.temperature_2m_max?.[0]            ?? null,
      rr10:     d.precipitation_probability_max?.[0] ?? null,
      sunHours
    };

    displayResult(communeName, forecast);

  } catch (e) {
    showError(e.message || 'Une erreur est survenue. Réessayez.');
  } finally {
    setLoader(false);
  }
});

/* ── 4. Affichage des résultats ── */
function displayResult(city, f) {
  resultCity.textContent = city.toUpperCase();

  const now = new Date();
  resultDate.textContent = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const fmt = (val, suffix) => val !== null ? `${val}${suffix}` : '—';

  const items = [
    { icon: '🌡️', value: fmt(f.tmin,     '°C'), label: 'T° min' },
    { icon: '🌡️', value: fmt(f.tmax,     '°C'), label: 'T° max' },
    { icon: '🌧️', value: fmt(f.rr10,     ' %'),  label: 'Prob. pluie' },
    { icon: '☀️',  value: fmt(f.sunHours, ' h'),  label: 'Ensoleillement' },
  ];

  metrics.innerHTML = items.map(({ icon, value, label }) => `
    <div class="metric">
      <div class="metric-icon" aria-hidden="true">${icon}</div>
      <div class="metric-value">${value}</div>
      <div class="metric-label">${label}</div>
    </div>
  `).join('');

  result.classList.add('visible');
}
