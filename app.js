const levelConfigs = [
  { name: "Dải màu bình yên", cols: 4, rows: 4, fixed: [0, 3, 12, 15], colors: ["#e95b68", "#f2be55", "#45a970", "#326fd8"] },
  { name: "Hoàng hôn nhỏ", cols: 5, rows: 4, fixed: [0, 4, 15, 19], colors: ["#673c90", "#e65f78", "#f0ba47", "#44a3a3"] },
  { name: "Vườn sau mưa", cols: 5, rows: 5, fixed: [0, 4, 20, 24, 12], colors: ["#254c7a", "#45a881", "#d8c75c", "#f3f0d8"] },
  { name: "Biển sáng", cols: 6, rows: 5, fixed: [0, 5, 24, 29], colors: ["#f4ecb7", "#58b9aa", "#2d6fb3", "#2e315f"] },
  { name: "Kẹo trái cây", cols: 6, rows: 6, fixed: [0, 5, 30, 35, 14, 21], colors: ["#ff6b72", "#ffd25d", "#66c778", "#6b69dd"] },
  { name: "Đêm thành phố", cols: 7, rows: 6, fixed: [0, 6, 35, 41, 20], colors: ["#1d2b53", "#5a58a9", "#d65d82", "#ffd166"] },
  { name: "Sương sớm", cols: 7, rows: 7, fixed: [0, 6, 42, 48, 24], colors: ["#e7f2ef", "#74b8a0", "#44799e", "#5e4b8b"] },
  { name: "Lễ hội sắc độ", cols: 8, rows: 7, fixed: [0, 7, 48, 55, 27, 28], colors: ["#df4d55", "#f0c94a", "#42a873", "#3d70d6"] },
  { name: "Aurora", cols: 8, rows: 8, fixed: [0, 7, 56, 63, 18, 45], colors: ["#19223f", "#2da6a1", "#b8dc6f", "#f5e3ff"] },
  { name: "Bậc thầy màu", cols: 9, rows: 8, fixed: [0, 8, 63, 71, 31, 40], colors: ["#101820", "#d44f68", "#eebd58", "#35a79c"] },
];

const modeCopy = {
  relax: {
    label: "Thư giãn",
    description: "Không giới hạn. Tập trung cảm nhận sắc độ và hoàn thành bức tranh màu.",
  },
  moves: {
    label: "Giới hạn lượt",
    description: "Hoàn thành trong số lượt tối ưu để đạt điểm cao nhất.",
  },
  time: {
    label: "Chạy giờ",
    description: "Đồng hồ đang chạy. Tìm nhịp màu thật nhanh và dứt khoát.",
  },
};

const state = {
  levelIndex: 0,
  mode: "relax",
  tiles: [],
  selectedIndex: null,
  moves: 0,
  hints: 3,
  startedAt: Date.now(),
  elapsedBeforePause: 0,
  timerId: null,
  undoStack: [],
  completedLevels: new Set(),
  bestScore: 0,
  isComplete: false,
};

const els = {
  board: document.querySelector("#board"),
  levelName: document.querySelector("#levelName"),
  levelNumber: document.querySelector("#levelNumber"),
  objective: document.querySelector("#objective"),
  challengeText: document.querySelector("#challengeText"),
  moves: document.querySelector("#moves"),
  accuracy: document.querySelector("#accuracy"),
  timer: document.querySelector("#timer"),
  undoBtn: document.querySelector("#undoBtn"),
  hintBtn: document.querySelector("#hintBtn"),
  hintCount: document.querySelector("#hintCount"),
  shuffleBtn: document.querySelector("#shuffleBtn"),
  scoreBar: document.querySelector("#scoreBar"),
  modeDescription: document.querySelector("#modeDescription"),
  completedCount: document.querySelector("#completedCount"),
  bestScore: document.querySelector("#bestScore"),
  levelList: document.querySelector("#levelList"),
  toast: document.querySelector("#toast"),
  completeDialog: document.querySelector("#completeDialog"),
  resultTitle: document.querySelector("#resultTitle"),
  resultText: document.querySelector("#resultText"),
  resultMoves: document.querySelector("#resultMoves"),
  resultTime: document.querySelector("#resultTime"),
  resultAccuracy: document.querySelector("#resultAccuracy"),
  nextBtn: document.querySelector("#nextBtn"),
  saveImageBtn: document.querySelector("#saveImageBtn"),
};

const storageKey = "sac-mau-save-v1";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixColor(a, b, c, d, x, y) {
  const top = {
    r: a.r + (b.r - a.r) * x,
    g: a.g + (b.g - a.g) * x,
    b: a.b + (b.b - a.b) * x,
  };
  const bottom = {
    r: c.r + (d.r - c.r) * x,
    g: c.g + (d.g - c.g) * x,
    b: c.b + (d.b - c.b) * x,
  };
  return rgbToHex({
    r: top.r + (bottom.r - top.r) * y,
    g: top.g + (bottom.g - top.g) * y,
    b: top.b + (bottom.b - top.b) * y,
  });
}

function buildSolution(config) {
  const [a, b, c, d] = config.colors.map(hexToRgb);
  const solution = [];
  for (let row = 0; row < config.rows; row += 1) {
    for (let col = 0; col < config.cols; col += 1) {
      const x = config.cols === 1 ? 0 : col / (config.cols - 1);
      const y = config.rows === 1 ? 0 : row / (config.rows - 1);
      solution.push(mixColor(a, b, c, d, x, y));
    }
  }
  return solution;
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function shuffledTiles(solution, fixed, seed) {
  const fixedSet = new Set(fixed);
  const movable = solution
    .map((color, answerIndex) => ({ color, answerIndex, fixed: fixedSet.has(answerIndex) }))
    .filter((tile) => !tile.fixed);
  const random = seededRandom(seed);

  for (let i = movable.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [movable[i], movable[j]] = [movable[j], movable[i]];
  }

  let movableIndex = 0;
  return solution.map((color, answerIndex) => {
    if (fixedSet.has(answerIndex)) {
      return { color, answerIndex, fixed: true };
    }
    return { ...movable[movableIndex++], fixed: false };
  });
}

function getConfig() {
  return levelConfigs[state.levelIndex];
}

function getMoveLimit() {
  const config = getConfig();
  return Math.round(config.cols * config.rows * 1.15);
}

function getTimeLimit() {
  const config = getConfig();
  return 35 + config.cols * config.rows * 2;
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function getElapsedSeconds() {
  return Math.floor((Date.now() - state.startedAt) / 1000) + state.elapsedBeforePause;
}

function getAccuracy() {
  const correct = state.tiles.filter((tile, index) => tile.answerIndex === index).length;
  return Math.round((correct / state.tiles.length) * 100);
}

function calculateScore() {
  const accuracy = getAccuracy();
  if (accuracy < 100) return accuracy;

  const config = getConfig();
  const base = 100;
  const movePenalty = Math.max(0, state.moves - config.cols * config.rows * 0.45) * 0.55;
  const timePenalty = Math.max(0, getElapsedSeconds() - config.cols * config.rows * 1.25) * 0.18;
  return Math.round(clamp(base - movePenalty - timePenalty, 60, 100));
}

function saveProgress() {
  const payload = {
    levelIndex: state.levelIndex,
    mode: state.mode,
    completedLevels: [...state.completedLevels],
    bestScore: state.bestScore,
  };
  localStorage.setItem(storageKey, JSON.stringify(payload));
}

function loadProgress() {
  try {
    const payload = JSON.parse(localStorage.getItem(storageKey) || "{}");
    state.levelIndex = clamp(payload.levelIndex || 0, 0, levelConfigs.length - 1);
    state.mode = modeCopy[payload.mode] ? payload.mode : "relax";
    state.completedLevels = new Set(payload.completedLevels || []);
    state.bestScore = payload.bestScore || 0;
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 1800);
}

function updateStats() {
  const accuracy = getAccuracy();
  const elapsed = getElapsedSeconds();
  els.moves.textContent = state.moves;
  els.accuracy.textContent = `${accuracy}%`;
  els.timer.textContent = formatTime(elapsed);
  els.scoreBar.style.width = `${accuracy}%`;
  els.hintCount.textContent = state.hints;
  els.undoBtn.disabled = state.undoStack.length === 0 || state.isComplete;
  els.hintBtn.disabled = state.hints <= 0 || state.isComplete;
  els.shuffleBtn.disabled = state.isComplete;
  els.completedCount.textContent = state.completedLevels.size;
  els.bestScore.textContent = `${state.bestScore}%`;

  if (state.mode === "moves") {
    const remaining = Math.max(0, getMoveLimit() - state.moves);
    els.challengeText.textContent = `${remaining} lượt`;
    if (remaining === 0 && accuracy < 100) {
      showToast("Hết lượt rồi. Hãy thử xáo lại hoặc chuyển chế độ Êm.");
    }
  } else if (state.mode === "time") {
    const remaining = Math.max(0, getTimeLimit() - elapsed);
    els.challengeText.textContent = `${formatTime(remaining)}`;
    if (remaining === 0 && accuracy < 100) {
      showToast("Hết giờ rồi. Bạn vẫn có thể hoàn thành để luyện mắt.");
    }
  }
}

function renderBoard() {
  const config = getConfig();
  els.board.style.setProperty("--cols", config.cols);
  els.board.style.setProperty("--rows", config.rows);
  els.board.innerHTML = "";

  state.tiles.forEach((tile, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tile";
    button.style.setProperty("--tile-color", tile.color);
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-label", tile.fixed ? "Ô màu cố định" : "Ô màu có thể di chuyển");
    button.dataset.index = index;
    button.draggable = !tile.fixed;
    if (tile.fixed) button.classList.add("is-fixed");
    if (state.selectedIndex === index) button.classList.add("is-selected");
    els.board.appendChild(button);
  });
}

function renderLevels() {
  const maxUnlocked = Math.min(
    levelConfigs.length - 1,
    Math.max(state.completedLevels.size + 1, state.levelIndex),
  );
  els.levelList.innerHTML = "";
  levelConfigs.forEach((level, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level-dot";
    button.textContent = index + 1;
    button.title = level.name;
    button.setAttribute("aria-label", `Cấp ${index + 1}: ${level.name}`);
    if (index === state.levelIndex) button.classList.add("is-active");
    if (index > maxUnlocked) {
      button.classList.add("is-locked");
      button.disabled = true;
    }
    button.addEventListener("click", () => startLevel(index));
    els.levelList.appendChild(button);
  });
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".mode-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  els.modeDescription.textContent = modeCopy[mode].description;
  saveProgress();
  startLevel(state.levelIndex);
}

function startTimer() {
  window.clearInterval(state.timerId);
  state.timerId = window.setInterval(updateStats, 500);
}

function startLevel(index) {
  state.levelIndex = clamp(index, 0, levelConfigs.length - 1);
  const config = getConfig();
  const solution = buildSolution(config);
  state.tiles = shuffledTiles(solution, config.fixed, (state.levelIndex + 3) * 997);
  state.selectedIndex = null;
  state.moves = 0;
  state.hints = 3;
  state.undoStack = [];
  state.startedAt = Date.now();
  state.elapsedBeforePause = 0;
  state.isComplete = false;

  els.levelName.textContent = config.name;
  els.levelNumber.textContent = state.levelIndex + 1;
  els.objective.textContent =
    state.mode === "relax"
      ? "Sắp xếp các ô để màu chuyển mượt từ trái sang phải, từ trên xuống dưới."
      : "Tìm vị trí đúng của từng sắc độ trước khi thử thách kết thúc.";
  els.challengeText.textContent = modeCopy[state.mode].label;
  els.modeDescription.textContent = modeCopy[state.mode].description;

  renderBoard();
  renderLevels();
  updateStats();
  startTimer();
  saveProgress();
}

function canMove(index) {
  return !state.isComplete && state.tiles[index] && !state.tiles[index].fixed;
}

function swapTiles(from, to, shouldCountMove = true) {
  if (from === to || !canMove(from) || !canMove(to)) return false;

  state.undoStack.push(state.tiles.map((tile) => ({ ...tile })));
  [state.tiles[from], state.tiles[to]] = [state.tiles[to], state.tiles[from]];
  if (shouldCountMove) state.moves += 1;
  state.selectedIndex = null;
  renderBoard();
  updateStats();
  checkComplete();
  return true;
}

function handleTileClick(index) {
  if (!canMove(index)) return;
  if (state.selectedIndex === null) {
    state.selectedIndex = index;
    renderBoard();
    return;
  }
  if (state.selectedIndex === index) {
    state.selectedIndex = null;
    renderBoard();
    return;
  }
  swapTiles(state.selectedIndex, index);
}

function undo() {
  const last = state.undoStack.pop();
  if (!last) return;
  state.tiles = last;
  state.moves = Math.max(0, state.moves - 1);
  state.selectedIndex = null;
  renderBoard();
  updateStats();
}

function shuffleCurrent() {
  const snapshot = state.tiles.map((tile) => ({ ...tile }));
  const movableIndexes = state.tiles
    .map((tile, index) => (tile.fixed ? null : index))
    .filter((index) => index !== null);
  const random = seededRandom(Date.now() % 100000);

  for (let i = movableIndexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = movableIndexes[i];
    const b = movableIndexes[j];
    [state.tiles[a], state.tiles[b]] = [state.tiles[b], state.tiles[a]];
  }

  state.undoStack.push(snapshot);
  state.moves += 1;
  state.selectedIndex = null;
  renderBoard();
  updateStats();
}

function useHint() {
  if (state.hints <= 0 || state.isComplete) return;
  const wrongIndex = state.tiles.findIndex((tile, index) => !tile.fixed && tile.answerIndex !== index);
  if (wrongIndex === -1) {
    showToast("Mọi ô đã đúng vị trí.");
    return;
  }
  const currentIndex = state.tiles.findIndex((tile) => tile.answerIndex === wrongIndex);

  state.hints -= 1;
  if (currentIndex !== -1 && canMove(currentIndex) && canMove(wrongIndex)) {
    swapTiles(currentIndex, wrongIndex);
  } else {
    highlightTile(wrongIndex);
    showToast("Ô đang nhấp nháy cần đổi sang vị trí màu mượt hơn.");
  }
  updateStats();
}

function highlightTile(index) {
  const tile = els.board.querySelector(`[data-index="${index}"]`);
  if (!tile) return;
  tile.classList.remove("is-hint");
  requestAnimationFrame(() => tile.classList.add("is-hint"));
}

function checkComplete() {
  if (state.tiles.some((tile, index) => tile.answerIndex !== index)) return;
  state.isComplete = true;
  window.clearInterval(state.timerId);
  const score = calculateScore();
  state.bestScore = Math.max(state.bestScore, score);
  state.completedLevels.add(state.levelIndex);
  saveProgress();
  updateStats();
  renderLevels();
  showComplete(score);
}

function showComplete(score) {
  const elapsed = getElapsedSeconds();
  els.resultMoves.textContent = state.moves;
  els.resultTime.textContent = formatTime(elapsed);
  els.resultAccuracy.textContent = `${score}%`;
  els.resultTitle.textContent = score >= 95 ? "Mắt màu rất bén!" : score >= 82 ? "Rất mượt!" : "Đã hoàn thành!";
  els.resultText.textContent =
    state.levelIndex < levelConfigs.length - 1
      ? "Một bức tranh màu mới đã mở. Tiếp tục tăng độ khó nhé."
      : "Bạn đã đi hết bộ cấp độ đầu tiên. Đây là nền tốt để mở rộng thành game lớn hơn.";

  if (typeof els.completeDialog.showModal === "function") {
    els.completeDialog.showModal();
  } else {
    showToast("Hoàn thành màn chơi.");
  }
}

function downloadBoardImage() {
  const config = getConfig();
  const size = 960;
  const gap = Math.max(6, Math.floor(size * 0.008));
  const tileW = (size - gap * (config.cols + 1)) / config.cols;
  const tileH = (size - gap * (config.rows + 1)) / config.rows;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = Math.round(gap + config.rows * tileH + config.rows * gap);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff8ee";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  state.tiles.forEach((tile, index) => {
    const row = Math.floor(index / config.cols);
    const col = index % config.cols;
    ctx.fillStyle = tile.color;
    ctx.fillRect(gap + col * (tileW + gap), gap + row * (tileH + gap), tileW, tileH);
  });

  const link = document.createElement("a");
  link.download = `sac-mau-cap-${state.levelIndex + 1}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function bindEvents() {
  els.board.addEventListener("click", (event) => {
    const tile = event.target.closest(".tile");
    if (!tile) return;
    handleTileClick(Number(tile.dataset.index));
  });

  els.board.addEventListener("dragstart", (event) => {
    const tile = event.target.closest(".tile");
    if (!tile || !canMove(Number(tile.dataset.index))) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("text/plain", tile.dataset.index);
  });

  els.board.addEventListener("dragover", (event) => {
    if (event.target.closest(".tile")) event.preventDefault();
  });

  els.board.addEventListener("drop", (event) => {
    const tile = event.target.closest(".tile");
    if (!tile) return;
    event.preventDefault();
    const from = Number(event.dataTransfer.getData("text/plain"));
    const to = Number(tile.dataset.index);
    swapTiles(from, to);
  });

  els.undoBtn.addEventListener("click", undo);
  els.shuffleBtn.addEventListener("click", shuffleCurrent);
  els.hintBtn.addEventListener("click", useHint);

  document.querySelectorAll(".mode-btn").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  els.nextBtn.addEventListener("click", () => {
    els.completeDialog.close();
    startLevel((state.levelIndex + 1) % levelConfigs.length);
  });

  els.saveImageBtn.addEventListener("click", downloadBoardImage);

  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      state.elapsedBeforePause = getElapsedSeconds();
      state.startedAt = Date.now();
    }
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // The game still works without offline install support.
    });
  });
}

function init() {
  loadProgress();
  bindEvents();
  setMode(state.mode);
  registerServiceWorker();
}

init();
