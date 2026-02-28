// Variables de estado globales
let data = null;                     // Datos cargados desde data.json
let readLectures = new Set();        // IDs de lecturas leídas
let doneFC = new Set();              // Índices de flashcards vistas (índices originales)
let doneQ = new Set();               // Índices de preguntas respondidas correctamente (índices originales)
let curFC = 0;                       // Índice actual en la lista mezclada de flashcards
let curQ = 0;                        // Índice actual en la lista mezclada de quiz

let shuffledFlashcardsIndices = [];   // Orden mezclado de índices de flashcards
let shuffledQuizIndices = [];         // Orden mezclado de índices de preguntas

const STORAGE_KEY = 'maritimeEthicsProgress';
const DARK_MODE_KEY = 'darkMode';

// Función para mezclar array (Fisher-Yates)
function shuffleArray(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Cargar datos al iniciar
async function loadData() {
  try {
    const response = await fetch('data.json');
    data = await response.json();

    // Inicializar índices mezclados
    if (data.flashcards) {
      shuffledFlashcardsIndices = shuffleArray([...Array(data.flashcards.length).keys()]);
    }
    if (data.quiz) {
      shuffledQuizIndices = shuffleArray([...Array(data.quiz.length).keys()]);
    }

    initFlashcards();
    initQuiz();
    loadProgress();
    updateProgress();
    setupKeyboardNav();

    // Forzar render del quiz cuando se active su pestaña
    const quizTab = document.querySelector('[data-bs-target="#quiz"]');
    if (quizTab) {
      quizTab.addEventListener('shown.bs.tab', function () {
        renderQ();
      });
    }
  } catch (error) {
    console.error('Error cargando data.json:', error);
    const quizOptions = document.getElementById('quiz-options');
    if (quizOptions) {
      quizOptions.innerHTML = '<p class="text-danger">Error al cargar los datos. Verifica la consola.</p>';
    }
  }
}

// ---------- FLASHCARDS ----------
function initFlashcards() {
  if (!data || !data.flashcards || data.flashcards.length === 0) {
    document.getElementById('fc-front').textContent = 'No hay flashcards';
    return;
  }
  curFC = 0;
  renderFC();
}

function renderFC() {
  const originalIndex = shuffledFlashcardsIndices[curFC];
  const fc = data.flashcards[originalIndex];
  document.getElementById('fc-front').textContent = fc.f;
  document.getElementById('fc-back').textContent = fc.b;
  document.getElementById('fc-counter').textContent =
    `${curFC + 1} / ${data.flashcards.length}`;

  doneFC.add(originalIndex);
  saveProgress();
  updateProgress();

  const container = document.querySelector('.card-flip-container');
  if (container) container.classList.remove('flipped');
}

function changeFC(dir) {
  if (!data || !data.flashcards || data.flashcards.length === 0) return;
  curFC = (curFC + dir + data.flashcards.length) % data.flashcards.length;
  renderFC();
}

// Función para mezclar flashcards (shuffle)
function shuffleFlashcards() {
  if (!data || !data.flashcards) return;
  shuffledFlashcardsIndices = shuffleArray([...Array(data.flashcards.length).keys()]);
  curFC = 0;
  renderFC();
}

function setupKeyboardNav() {
  window.addEventListener('keydown', (e) => {
    const flashcardsTab = document.getElementById('flashcards');
    if (!flashcardsTab || !flashcardsTab.classList.contains('show')) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      changeFC(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      changeFC(1);
    }
  });
}

// ---------- QUIZ ----------
function initQuiz() {
  if (!data) {
    console.warn('initQuiz: data no está cargado aún');
    return;
  }
  if (!data.quiz || !Array.isArray(data.quiz) || data.quiz.length === 0) {
    console.error('initQuiz: no hay preguntas de quiz en los datos');
    const quizOptions = document.getElementById('quiz-options');
    if (quizOptions) {
      quizOptions.innerHTML = '<p class="text-warning">No hay preguntas disponibles.</p>';
    }
    return;
  }
  curQ = 0;
  renderQ();
}

function renderQ() {
  if (!data || !data.quiz || data.quiz.length === 0) {
    console.warn('renderQ: datos de quiz no disponibles');
    return;
  }
  const originalIndex = shuffledQuizIndices[curQ];
  const q = data.quiz[originalIndex];
  if (!q) {
    console.error('renderQ: pregunta actual es undefined', curQ);
    return;
  }

  const titleEl = document.getElementById('quiz-q-title');
  if (titleEl) titleEl.textContent = `Pregunta ${curQ + 1}`;

  const questionEl = document.getElementById('quiz-question');
  if (questionEl) questionEl.textContent = q.q || 'Pregunta no disponible';

  const progEl = document.getElementById('quiz-prog');
  if (progEl) progEl.textContent = `${curQ + 1} / ${data.quiz.length}`;

  const optCont = document.getElementById('quiz-options');
  if (!optCont) return;
  optCont.innerHTML = "";

  const expDiv = document.getElementById('quiz-exp');
  if (expDiv) {
    expDiv.style.display = 'none';
    expDiv.className = 'explanation-box rounded';
    expDiv.textContent = '';
  }

  const nextBtn = document.getElementById('btn-next-q');
  if (nextBtn) nextBtn.classList.add('d-none');

  if (!q.o || !Array.isArray(q.o) || q.o.length === 0) {
    optCont.innerHTML = '<p class="text-danger">Esta pregunta no tiene opciones definidas.</p>';
    return;
  }

  q.o.forEach((o, i) => {
    const btn = document.createElement('button');
    btn.className = "quiz-option btn text-start mb-2 d-block w-100";
    btn.textContent = o;
    btn.onclick = () => handleQuizAnswer(i, q.c, q.e, btn);
    optCont.appendChild(btn);
  });

  if (doneQ.has(originalIndex)) {
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(opt => opt.disabled = true);
    if (options[q.c]) options[q.c].classList.add('correct');
    if (expDiv) {
      expDiv.textContent = q.e || 'Explicación no disponible';
      expDiv.style.display = 'block';
    }
    if (nextBtn) nextBtn.classList.remove('d-none');
  }
}

function handleQuizAnswer(selectedIdx, correctIdx, explanation, btn) {
  const allOptions = document.querySelectorAll('.quiz-option');
  const expDiv = document.getElementById('quiz-exp');
  const nextBtn = document.getElementById('btn-next-q');
  const originalIndex = shuffledQuizIndices[curQ];

  if (doneQ.has(originalIndex)) return;

  if (selectedIdx === correctIdx) {
    doneQ.add(originalIndex);
    saveProgress();
    updateProgress();

    allOptions.forEach(opt => opt.disabled = true);
    btn.classList.add('correct');

    expDiv.textContent = explanation || '¡Correcto!';
    expDiv.style.display = 'block';
    nextBtn.classList.remove('d-none');
  } else {
    btn.classList.add('incorrect');
    expDiv.textContent = "❌ Incorrecto.";
    expDiv.classList.add('incorrect');
    expDiv.style.display = 'block';
    nextBtn.classList.add('d-none');
  }
}

function nextQuestion() {
  if (!data || !data.quiz || data.quiz.length === 0) return;
  curQ = (curQ + 1) % data.quiz.length;
  renderQ();
}

// ---------- LECTURAS (función mínima para evitar errores) ----------
function markAsRead(type, id) {
  if (type === 'lecture') {
    readLectures.add(id);
    saveProgress();
    updateProgress();
  }
}

// ---------- PROGRESS ----------
function updateProgress() {
  if (!data) return;

  const total =
    (data.lectures ? data.lectures.length : 0) +
    (data.flashcards ? data.flashcards.length : 0) +
    (data.quiz ? data.quiz.length : 0);

  const current = readLectures.size + doneFC.size + doneQ.size;
  const perc = total > 0 ? Math.round((current / total) * 100) : 0;

  const progBar = document.getElementById('global-progress');
  if (progBar) progBar.style.width = perc + "%";

  const progText = document.getElementById('progress-text');
  if (progText) progText.textContent = `${current} / ${total} hitos completados`;

  const badge = document.getElementById('progressBadge');
  if (badge) {
    badge.textContent = `${current} / ${total}`;
    if (perc === 100) {
      badge.classList.add('bg-success');
    } else {
      badge.classList.remove('bg-success');
    }
  }
}

// ---------- STORAGE ----------
function saveProgress() {
  const progress = {
    readLectures: Array.from(readLectures),
    doneFC: Array.from(doneFC),
    doneQ: Array.from(doneQ)
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function loadProgress() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    const progress = JSON.parse(saved);
    readLectures = new Set(progress.readLectures || []);
    doneFC = new Set(progress.doneFC || []);
    doneQ = new Set(progress.doneQ || []);
    updateProgress();
  } catch (e) {
    console.warn('Error al cargar progreso guardado', e);
  }
}

// ---------- DARK MODE ----------
function initDarkMode() {
  const darkModeToggle = document.getElementById('darkModeToggle');
  const darkModeFloating = document.getElementById('darkModeFloating');
  const darkModeIcons = document.querySelectorAll('.dark-mode-icon');

  if (!darkModeToggle || !darkModeFloating) return;

  function applyDarkMode(isDark) {
    if (isDark) {
      document.body.classList.add('dark-mode');
      darkModeIcons.forEach(icon => {
        icon.classList.remove('bi-moon-fill');
        icon.classList.add('bi-sun-fill');
      });
    } else {
      document.body.classList.remove('dark-mode');
      darkModeIcons.forEach(icon => {
        icon.classList.remove('bi-sun-fill');
        icon.classList.add('bi-moon-fill');
      });
    }
    localStorage.setItem(DARK_MODE_KEY, isDark);
  }

  function toggleDarkMode() {
    const isDark = !document.body.classList.contains('dark-mode');
    applyDarkMode(isDark);
  }

  const savedDarkMode = localStorage.getItem(DARK_MODE_KEY);
  applyDarkMode(savedDarkMode === 'true');

  darkModeToggle.addEventListener('click', toggleDarkMode);
  darkModeFloating.addEventListener('click', toggleDarkMode);
}

// Exponer funciones globales necesarias desde el HTML
window.markAsRead = markAsRead;
window.changeFC = changeFC;
window.nextQuestion = nextQuestion;
window.shuffleFlashcards = shuffleFlashcards;

// Inicializar cuando la página cargue
window.onload = function () {
  loadData();
  initDarkMode();
};