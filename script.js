const cityForm = document.getElementById('cityForm');
const communeStep = document.getElementById('communeStep');
const cpInput = document.getElementById('codePostal');
const communeSel = document.getElementById('commune');
const searchBtn = document.getElementById('searchBtn');
const loader = document.getElementById('loader');
const errorMsg = document.getElementById('errorMsg');
const result = document.getElementById('result');
const resultCity = document.getElementById('resultCity');
const resultDate = document.getElementById('resultDate');
const metrics = document.getElementById('metrics');
const reloadBtn = document.getElementById('reloadBtn');

let debounceTimer;

// 1. Écoute du Code Postal
cpInput.addEventListener('input', () => {
  const cp = cpInput.value.trim();
  errorMsg.classList.remove('visible');

  if (/^\d{5}$/.test(cp)) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchCommunes(cp), 300);
  } else {
    communeStep.classList.remove('visible');
  }
});

// 2. Récupération des communes via geo.api.gouv.fr [cite: 27]
async function fetchCommunes(cp) {
  try {
    const res = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}`);
    const data = await res.json();

    if (!data.length) {
      showError("Aucune ville trouvée pour ce code postal.");
      communeStep.classList.remove('visible');
      return;
    }

    communeSel.innerHTML = '';
    data.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.code; // Code INSEE
      opt.textContent = c.nom;
      communeSel.appendChild(opt);
    });

    communeStep.classList.add('visible');
  } catch (e) {
    showError("Erreur lors de la récupération des communes.");
  }
}

// 3. Appel API MétéoConcept [cite: 29]
searchBtn.addEventListener('click', async () => {
  const insee = communeSel.value;
  const name = communeSel.options[communeSel.selectedIndex].text;

  cityForm.style.display = 'none';
  loader.classList.add('visible');
  errorMsg.classList.remove('visible');

  try {
    // Utilisation des paramètres requis : Tmin, Tmax, Probabilité pluie, Ensoleillement [cite: 16, 17, 18, 19]
    const token = "4bba169b3e3365061d39563419ab23e5016c0f838ba282498439c41a00ef1091";
    const res = await fetch(`https://api.meteo-concept.com/api/forecast/daily/0?token=${token}&insee=${insee}`);
    const data = await res.json();

    if (!data.forecast) throw new Error("Données météo indisponibles.");

    displayWeather(name, data.forecast);
  } catch (e) {
    showError(e.message);
    cityForm.style.display = 'block';
  } finally {
    loader.classList.remove('visible');
  }
});

function displayWeather(city, f) {
  resultCity.textContent = city.toUpperCase();
  resultDate.textContent = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  const items = [
    { icon: '🌡️', val: `${f.tmin}°C`, label: 'Temp. Min' },
    { icon: '🔥', val: `${f.tmax}°C`, label: 'Temp. Max' },
    { icon: '🌧️', val: `${f.probarain}%`, label: 'Pluie' },
    { icon: '☀️', val: `${f.sun_hours} h`, label: 'Soleil' }
  ];

  metrics.innerHTML = items.map(i => `
    <div class="metric">
      <span class="metric-icon">${i.icon}</span>
      <div class="metric-value">${i.val}</div>
      <div class="metric-label">${i.label}</div>
    </div>
  `).join('');

  result.classList.add('visible');
}

function showError(m) {
  errorMsg.textContent = m;
  errorMsg.classList.add('visible');
}

reloadBtn.addEventListener('click', () => location.reload());