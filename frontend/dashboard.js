const API_BASE = "https://meu-drive-api.onrender.com";

const msg = document.getElementById("msg");
const list = document.getElementById("list");

const token = localStorage.getItem("access_token");
if (!token) window.location.href = "./index.html";

// elementos
const btnLogout = document.getElementById("btnLogout");
const btnUpload = document.getElementById("btnUpload");
const fileInput = document.getElementById("fileInput");
const folderInput = document.getElementById("folderInput");
const searchInput = document.getElementById("searchInput");

let allFiles = [];

function setMsg(text) {
  if (msg) msg.textContent = text || "";
}

function getFolderFromPath(storage_path) {
  const parts = (storage_path || "").split("/");
  return parts[1] || "root";
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0 KB";
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function shortType(mime, name) {
  if (mime) {
    if (mime.includes("pdf")) return "PDF";
    if (mime.includes("image/")) return "Imagem";
    if (mime.includes("video/")) return "Vídeo";
    if (mime.includes("audio/")) return "Áudio";
    if (mime.includes("text/")) return "Texto";
    if (mime.includes("zip") || mime.includes("rar") || mime.includes("7z")) return "Compactado";
  }
  const lower = (name || "").toLowerCase();
  if (lower.endsWith(".pdf")) return "PDF";
  if (/\.(png|jpg|jpeg|gif|webp)$/.test(lower)) return "Imagem";
  if (/\.(mp4|mov|mkv|webm)$/.test(lower)) return "Vídeo";
  if (/\.(mp3|wav|ogg)$/.test(lower)) return "Áudio";
  if (/\.(zip|rar|7z)$/.test(lower)) return "Compactado";
  if (/\.(txt|md|csv)$/.test(lower)) return "Texto";
  return "Arquivo";
}

// ===== LOGOUT =====
if (btnLogout) {
  btnLogout.onclick = () => {
    localStorage.removeItem("access_token");
    window.location.href = "./index.html";
  };
}

// ===== RENDER =====
function renderFiles(files) {
  list.innerHTML = "";

  if (!files || files.length === 0) {
    const li = document.createElement("li");
    li.className = "file-item";
    li.innerHTML = `<div class="small">Nenhum arquivo encontrado.</div>`;
    list.appendChild(li);
    return;
  }

  files.forEach((f) => {
    const name = f.display_name || f.original_name || "Sem nome";
    const folder = getFolderFromPath(f.storage_path);
    const size = formatBytes(f.size);
    const type = shortType(f.mime_type, f.original_name);
    const date = formatDate(f.created_at);

    const li = document.createElement("li");
    li.className = "file-item";

    // Layout 2 colunas: esquerda ações, direita infos
    li.innerHTML = `
      <div class="file-row">
        <div class="file-actions">
          <a class="link" href="${f.public_url}" target="_blank">Abrir</a>
          <button class="btn-secondary" data-rename="${f.id}">Renomear</button>
          <button class="btn-danger" data-del="${f.id}">Deletar</button>
        </div>

        <div class="file-info">
          <div class="file-name">${name}</div>
          <div class="small">
            Pasta: <b>${folder}</b><br/>
            Tipo: <b>${type}</b><br/>
            Tamanho: <b>${size}</b><br/>
            Enviado em: <b>${date}</b>
          </div>
        </div>
      </div>
    `;

    // delete
    li.querySelector(`[data-del="${f.id}"]`).onclick = () => deleteFile(f.id);

    // rename
    li.querySelector(`[data-rename="${f.id}"]`).onclick = async () => {
      const newName = prompt("Novo nome:", name);
      if (!newName) return;

      setMsg("Renomeando...");

      const res = await fetch(`${API_BASE}/files/${f.id}/rename`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ display_name: newName.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg(data.error || "Erro ao renomear.");

      setMsg("Renomeado!");
      loadFiles();
    };

    list.appendChild(li);
  });
}

// ===== CARREGAR =====
async function loadFiles() {
  setMsg("");

  const res = await fetch(`${API_BASE}/files`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    setMsg(data.error || "Erro ao carregar arquivos.");
    renderFiles([]);
    return;
  }

  allFiles = data.files || [];
  applySearch();
}

// ===== BUSCA =====
function applySearch() {
  const term = (searchInput?.value || "").trim().toLowerCase();
  if (!term) return renderFiles(allFiles);

  const filtered = allFiles.filter((f) => {
    const name = (f.display_name || f.original_name || "").toLowerCase();
    const folder = getFolderFromPath(f.storage_path).toLowerCase();
    return name.includes(term) || folder.includes(term);
  });

  renderFiles(filtered);
}

if (searchInput) {
  searchInput.addEventListener("input", applySearch);
}

// ===== UPLOAD =====
async function uploadFile() {
  setMsg("Enviando...");

  const file = fileInput?.files?.[0];
  if (!file) return setMsg("Selecione um arquivo.");

  const folder = (folderInput?.value || "root").trim();

  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);

  const res = await fetch(`${API_BASE}/files/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return setMsg(data.error || "Erro no upload.");
  }

  setMsg("Upload feito!");
  if (fileInput) fileInput.value = "";
  loadFiles();
}

if (btnUpload) {
  btnUpload.onclick = uploadFile;
}

// ===== DELETE =====
async function deleteFile(id) {
  const ok = confirm("Deseja deletar este arquivo?");
  if (!ok) return;

  setMsg("Deletando...");

  const res = await fetch(`${API_BASE}/files/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return setMsg(data.error || "Erro ao deletar.");
  }

  setMsg("Deletado!");
  loadFiles();
}

// iniciar
loadFiles();
