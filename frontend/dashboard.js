const API_BASE = "COLE_AQUI_URL_DA_SUA_API_RENDER"; // ex: https://meu-drive-api.onrender.com

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
  const res = await fetch(`${API_BASE}/files`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) return (msg.textContent = data.error || "Erro ao carregar.");

  data.files.forEach(f => {
    const li = document.createElement("li");
    li.innerHTML = `
      <b>${f.original_name}</b><br/>
      <a href="${f.public_url}" target="_blank">Abrir link público</a>
      <button data-id="${f.id}">Deletar</button>
    `;
    li.querySelector("button").onclick = () => deleteFile(f.id);
    list.appendChild(li);
  });
}

async function uploadFile() {
  msg.textContent = "Enviando...";
  const file = document.getElementById("fileInput").files[0];
  if (!file) return (msg.textContent = "Selecione um arquivo.");

  const form = new FormData();
  form.append("file", file);

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
