const API_BASE = "https://meu-drive-api.onrender.com";

const msg = document.getElementById("msg");
const list = document.getElementById("list");

const token = localStorage.getItem("access_token");
if (!token) window.location.href = "./index.html";

document.getElementById("btnLogout").onclick = () => {
  localStorage.removeItem("access_token");
  window.location.href = "./index.html";
};

async function loadFiles() {
  list.innerHTML = "";
  msg.textContent = "";

  const res = await fetch(`${API_BASE}/files`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  if (!res.ok) {
    msg.textContent = data.error || "Erro ao carregar.";
    return;
  }

  if (!data.files.length) {
    const li = document.createElement("li");
    li.textContent = "Nenhum arquivo ainda.";
    list.appendChild(li);
    return;
  }

  allFiles = data.files;
renderFiles(allFiles);
function renderFiles(files) {
  list.innerHTML = "";

  if (!files.length) {
    const li = document.createElement("li");
    li.textContent = "Nenhum arquivo encontrado.";
    list.appendChild(li);
    return;
  }

  files.forEach(f => {
    const name = f.display_name || f.original_name;
    const folder = f.storage_path.split("/")[1] || "root";

    const li = document.createElement("li");
    li.className = "file-item";
    li.innerHTML = `
      <div class="file-name">${name}</div>
      <div class="small">Pasta: ${folder}</div>
      <div class="actions">
        <a class="link" href="${f.public_url}" target="_blank">Abrir</a>
        <button data-rename="${f.id}" class="btn-secondary">Renomear</button>
        <button data-del="${f.id}" class="btn-danger">Deletar</button>
      </div>
    `;

    li.querySelector(`[data-del="${f.id}"]`).onclick = () => deleteFile(f.id);
    li.querySelector(`[data-rename="${f.id}"]`).onclick = async () => {
      const newName = prompt("Novo nome:", name);
      if (!newName) return;

      const res = await fetch(`${API_BASE}/files/${f.id}/rename`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ display_name: newName })
      });

      if (res.ok) loadFiles();
    };

    list.appendChild(li);
  });
}

    const name = f.display_name || f.original_name;

    const li = document.createElement("li");
    li.innerHTML = `
      <b>${name}</b><br/>
      <a href="${f.public_url}" target="_blank">Abrir link público</a>
      <button data-rename="${f.id}">Renomear</button>
      <button data-del="${f.id}">Deletar</button>
    `;

    li.querySelector(`[data-del="${f.id}"]`).onclick = () => deleteFile(f.id);

    li.querySelector(`[data-rename="${f.id}"]`).onclick = async () => {
      const newName = prompt("Novo nome:", name);
      if (!newName) return;

      const res = await fetch(`${API_BASE}/files/${f.id}/rename`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ display_name: newName.trim() })
      });

      const data = await res.json();
      if (!res.ok) return (msg.textContent = data.error || "Erro ao renomear.");

      loadFiles();
    };

    list.appendChild(li);
  });
}

async function uploadFile() {
  msg.textContent = "Enviando...";

  const file = document.getElementById("fileInput").files[0];
  if (!file) return (msg.textContent = "Selecione um arquivo.");

  const folder = (document.getElementById("folderInput").value || "root").trim();

  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);

  const res = await fetch(`${API_BASE}/files/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });

  const data = await res.json();
  if (!res.ok) return (msg.textContent = data.error || "Erro no upload.");

  msg.textContent = "Upload feito!";
  document.getElementById("fileInput").value = "";
  loadFiles();
}

async function deleteFile(id) {
  const res = await fetch(`${API_BASE}/files/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  if (!res.ok) return (msg.textContent = data.error || "Erro ao deletar.");

  msg.textContent = "Deletado!";
  loadFiles();
}

document.getElementById("btnUpload").onclick = uploadFile;
loadFiles();

const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("input", () => {
  const term = searchInput.value.toLowerCase();

  const filtered = allFiles.filter(f => {
    const name = (f.display_name || f.original_name).toLowerCase();
    const folder = f.storage_path.toLowerCase();
    return name.includes(term) || folder.includes(term);
  });

  renderFiles(filtered);
});

