document.addEventListener("DOMContentLoaded", () => {
  // TODO o seu código do dashboard.js fica aqui dentro
});

const API_BASE = "https://meu-drive-api.onrender.com";

const token = localStorage.getItem("access_token");
if (!token) window.location.href = "./index.html";

// elementos base
const btnLogout = document.getElementById("btnLogout");
const btnUpload = document.getElementById("btnUpload");
const fileInput = document.getElementById("fileInput");
const folderInput = document.getElementById("folderInput");
const searchInput = document.getElementById("searchInput");
const msg = document.getElementById("msg");

// galeria / pastas
const foldersEl = document.getElementById("folders");
const gridFilesEl = document.getElementById("gridFiles");

// toast
const toast = document.getElementById("toast");
const toastTitle = document.getElementById("toastTitle");
const toastText = document.getElementById("toastText");
let toastTimer = null;

// modal preview
const previewModal = document.getElementById("previewModal");
const previewImg = document.getElementById("previewImg");
const btnDownloadPreview = document.getElementById("btnDownloadPreview");
const previewTitle = document.getElementById("previewTitle");
const btnClosePreview = document.getElementById("btnClosePreview");

let allFiles = [];
let currentFolder = "all"; // all | root | Fotos...

function setMsg(text) {
  if (msg) msg.textContent = text || "";
}

function showToast(title, text) {
  if (!toast || !toastTitle || !toastText) {
    setMsg(`${title}: ${text}`);
    return;
  }
  toastTitle.textContent = title;
  toastText.textContent = text;
  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function getFolderFromPath(storage_path) {
  const parts = (storage_path || "").split("/");
  return parts[1] || "root";
}

function isImageFile(mime, name) {
  if (mime && mime.startsWith("image/")) return true;
  const lower = (name || "").toLowerCase();
  return /\.(png|jpg|jpeg|gif|webp)$/.test(lower);
}

// ===== Modal Preview =====
function openPreview(url, title) {
  if (!previewModal || !previewImg) return window.open(url, "_blank");
  previewTitle.textContent = title || "Preview";
  previewImg.src = url;
  previewModal.classList.add("show");
}
function openPreview(url, title) {
  if (!previewModal || !previewImg) return window.open(url, "_blank");

  previewTitle.textContent = title || "Preview";
  previewImg.src = url;

  if (btnDownloadPreview) {
    btnDownloadPreview.href = url;
    btnDownloadPreview.setAttribute("download", title || "arquivo");
  }

  previewModal.classList.add("show");
}

if (btnClosePreview) btnClosePreview.onclick = closePreview;
if (previewModal) {
  previewModal.addEventListener("click", (e) => {
    if (e.target === previewModal) closePreview();
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePreview();
});

// ===== Logout =====
if (btnLogout) {
  btnLogout.onclick = () => {
    localStorage.removeItem("access_token");
    showToast("Sessão", "Você saiu da conta.");
    setTimeout(() => (window.location.href = "./index.html"), 250);
  };
}

// ===== Pastas =====
function renderFolders(files) {
  const set = new Set(files.map(f => getFolderFromPath(f.storage_path)));
  const folders = ["all", ...Array.from(set).sort((a,b)=>a.localeCompare(b))];

  foldersEl.innerHTML = "";
  folders.forEach(name => {
    const btn = document.createElement("button");
    btn.className = "folder-btn" + (currentFolder === name ? " active" : "");
    btn.textContent = name === "all" ? "Todos" : name;
    btn.onclick = () => {
      currentFolder = name;
      renderFolders(allFiles);
      renderGrid();
    };
    foldersEl.appendChild(btn);
  });
}

// ===== GRID =====
function getFilteredFiles() {
  const term = (searchInput?.value || "").trim().toLowerCase();

  return allFiles.filter(f => {
    const folder = getFolderFromPath(f.storage_path);
    const name = (f.display_name || f.original_name || "").toLowerCase();

    const matchFolder = currentFolder === "all" ? true : folder === currentFolder;
    const matchSearch = !term ? true : (name.includes(term) || folder.toLowerCase().includes(term));

    return matchFolder && matchSearch;
  });
}

function renderGrid() {
  const files = getFilteredFiles();

  gridFilesEl.innerHTML = "";

  if (!files.length) {
    const empty = document.createElement("div");
    empty.className = "small";
    empty.textContent = "Nenhum arquivo encontrado.";
    gridFilesEl.appendChild(empty);
    return;
  }

  files.forEach(f => {
  const name = f.display_name || f.original_name || "Sem nome";
  const isImg = isImageFile(f.mime_type, f.original_name);

  const card = document.createElement("div");
  card.className = "file-card";

  if (isImg) {
    // ✅ IMAGEM
    card.innerHTML = `
      <img class="thumb" src="${f.public_url}" alt="${name}" />
      <div class="thumb-name">${name}</div>
    `;

    card.querySelector(".thumb").onclick = () => {
      openPreview(f.public_url, name);
    };

  } else {
    // ✅ NÃO IMAGEM (PDF, ZIP, etc.)
    card.innerHTML = `
      <div class="file-icon">📄</div>
      <div class="thumb-name">${name}</div>
    `;

    card.onclick = () => {
      window.open(f.public_url, "_blank");
    };
  }

  gridFilesEl.appendChild(card);
});
      card.onclick = () => window.open(f.public_url, "_blank");
    }

    gridFilesEl.appendChild(card);
  });
}

// ===== Load =====
async function loadFiles() {
  const res = await fetch(`${API_BASE}/files`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    showToast("Erro", data.error || "Erro ao carregar arquivos.");
    allFiles = [];
    renderFolders(allFiles);
    renderGrid();
    return;
  }

  allFiles = data.files || [];
  renderFolders(allFiles);
  renderGrid();
}

// ===== Upload =====
async function uploadFile() {
  const file = fileInput?.files?.[0];
  if (!file) return showToast("Atenção", "Selecione um arquivo.");

  const folder = (folderInput?.value || "root").trim();

  showToast("Upload", "Enviando...");

  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);

  const res = await fetch(`${API_BASE}/files/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return showToast("Erro", data.error || "Erro no upload.");

  showToast("Sucesso", "Arquivo enviado!");
  if (fileInput) fileInput.value = "";
  loadFiles();
}

if (btnUpload) btnUpload.onclick = uploadFile;
if (searchInput) searchInput.addEventListener("input", renderGrid);

// inicia
loadFiles();
