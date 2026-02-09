const API_BASE = "https://meu-drive-api.onrender.com";

const msg = document.getElementById("msg");
const list = document.getElementById("list");

const token = localStorage.getItem("access_token");
if (!token) window.location.href = "./index.html";

// elementos (podem existir no HTML)
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
  // formato: userId/folder/arquivo
  const parts = (storage_path || "").split("/");
  return parts[1] || "root";
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

  files.forEach(f => {
    const name = f.display_name || f.original_name;
    const folder = getFolderFromPath(f.storage_path);

    const li = document.createElement("li");
    li.className = "file-item";
    li.innerHTML = `
      <div class="file-name">${name}</div>
      <div class="small">Pasta: ${folder}</div>

      <div class="actions">
        <a class="link" href="${f.public_url}" target="_blank">Abrir</a>
        <button class="btn-secondary" data-rename="${f.id}">Renomear</button>
        <button class="btn-danger" data-del="${f.id}">Deletar</button>
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ display_name: newName.trim() })
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
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    setMsg(data.error || "Erro ao carregar arquivos.");
    renderFiles([]);
    return;
  }

  allFiles = data.files || [];
  applySearch(); // renderiza já com filtro atual
}

// ===== BUSCA =====
function applySearch() {
  if (!searchInput) {
    renderFiles(allFiles);
    return;
  }

  const term = (searchInput.value || "").trim().toLowerCase();
  if (!term) return renderFiles(allFiles);

  const filtered = allFiles.filter(f => {
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
    body: form
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
  setMsg("Deletando...");

  const res = await fetch(`${API_BASE}/files/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return setMsg(data.error || "Erro ao deletar.");
  }

  setMsg("Deletado!");
  loadFiles();
}

// inicia
loadFiles();
