document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://meu-drive-api.onrender.com";
    // ===== PWA: garante update do Service Worker =====
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      reg.update().catch(() => {});
    }).catch(() => {});
  }

  // ===== Offline Queue (IndexedDB) =====
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("meuDriveDB", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("uploadQueue")) {
          db.createObjectStore("uploadQueue", { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function queueUpload({ file, folder }) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("uploadQueue", "readwrite");
      const store = tx.objectStore("uploadQueue");

      const item = {
        id: (crypto?.randomUUID?.() || String(Date.now()) + Math.random()),
        folder: folder || "root",
        name: file.name,
        type: file.type,
        size: file.size,
        createdAt: Date.now(),
        blob: file
      };

      store.put(item);
      tx.oncomplete = () => resolve(item);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getQueuedUploads() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("uploadQueue", "readonly");
      const store = tx.objectStore("uploadQueue");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function removeQueuedUpload(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("uploadQueue", "readwrite");
      tx.objectStore("uploadQueue").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function syncUploads() {
    if (!navigator.onLine) return;

    let items = [];
    try {
      items = await getQueuedUploads();
    } catch {
      return; // se IndexedDB falhar, não trava o app
    }

    if (!items.length) return;

    showToast("Sincronizando", `Enviando ${items.length} pendente(s)...`);

    for (const item of items) {
      try {
        const form = new FormData();
        form.append("file", item.blob, item.name);
        form.append("folder", item.folder || "root");

        const res = await fetch(`${API_BASE}/files/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form
        });

        if (res.ok) {
          await removeQueuedUpload(item.id);
        } else {
          break; // para e tenta depois
        }
      } catch {
        break;
      }
    }

    showToast("Ok", "Sync finalizado.");
    loadFiles();
  }

  window.addEventListener("online", () => syncUploads());


  const token = localStorage.getItem("access_token");
  if (!token) {
    window.location.href = "./index.html";
    return;
  }

  // ===== Elements =====
  const btnLogout = document.getElementById("btnLogout");
  const btnUpload = document.getElementById("btnUpload");
  const fileInput = document.getElementById("fileInput");
  const folderInput = document.getElementById("folderInput");
  const searchInput = document.getElementById("searchInput");
  const msg = document.getElementById("msg");

  const foldersEl = document.getElementById("folders");
  const gridFilesEl = document.getElementById("gridFiles");
  const btnBackFolder = document.getElementById("btnBackFolder");
  const filesTitle = document.getElementById("filesTitle");

  // Toast
  const toast = document.getElementById("toast");
  const toastTitle = document.getElementById("toastTitle");
  const toastText = document.getElementById("toastText");
  let toastTimer = null;

  // Modal preview
  const previewModal = document.getElementById("previewModal");
  const previewImg = document.getElementById("previewImg");
  const previewTitle = document.getElementById("previewTitle");
  const btnClosePreview = document.getElementById("btnClosePreview");
  const btnDownloadPreview = document.getElementById("btnDownloadPreview");

  let allFiles = [];
  let currentFolder = null; // null = "Todos"

  // ===== Helpers =====
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
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
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

  // ===== Preview =====
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

  function closePreview() {
    if (!previewModal) return;
    previewModal.classList.remove("show");
    if (previewImg) previewImg.src = "";
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

  // ===== Pasta UI =====
  function updateFolderUI() {
    if (btnBackFolder) btnBackFolder.style.display = currentFolder ? "inline-flex" : "none";
    if (filesTitle) filesTitle.textContent = currentFolder ? `Pasta: ${currentFolder}` : "Meus arquivos";
  }

  if (btnBackFolder) {
    btnBackFolder.onclick = () => {
      currentFolder = null;
      updateFolderUI();
      renderFolders(allFiles);
      renderGrid();
    };
  }

  function renderFolders(files) {
    if (!foldersEl) return;

    const set = new Set(files.map((f) => getFolderFromPath(f.storage_path)));
    const folders = Array.from(set).sort((a, b) => a.localeCompare(b));
    foldersEl.innerHTML = "";

    if (currentFolder === null) {
      const wrap = document.createElement("div");
      wrap.className = "folders-grid";

      const allBtn = document.createElement("button");
      allBtn.type = "button";
      allBtn.className = "folder-card active";
      allBtn.textContent = "Todos";
      allBtn.onclick = () => {
        currentFolder = null;
        updateFolderUI();
        renderFolders(allFiles);
        renderGrid();
      };
      wrap.appendChild(allBtn);

      folders.forEach((name) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "folder-card";
        btn.textContent = name;
        btn.onclick = () => {
          currentFolder = name;
          updateFolderUI();
          renderFolders(allFiles);
          renderGrid();
        };
        wrap.appendChild(btn);
      });

      foldersEl.appendChild(wrap);
    }
  }

  function getFilteredFiles() {
    const term = (searchInput?.value || "").trim().toLowerCase();

    return allFiles.filter((f) => {
      const folder = getFolderFromPath(f.storage_path);
      const name = (f.display_name || f.original_name || "").toLowerCase();

      const matchFolder = currentFolder ? folder === currentFolder : true;
      const matchSearch = !term ? true : name.includes(term);

      return matchFolder && matchSearch;
    });
  }

  // ===== API actions =====
  async function renameFile(fileId, currentName) {
    const newName = prompt("Novo nome:", currentName);
    if (!newName) return;

    showToast("Renomear", "Renomeando...");

    const res = await fetch(`${API_BASE}/files/${fileId}/rename`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ display_name: newName.trim() }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return showToast("Erro", data.error || "Erro ao renomear.");

    showToast("Sucesso", "Renomeado!");
    loadFiles();
  }

  async function moveFile(fileId, currentName) {
    const newFolder = prompt("Mover para qual pasta? (ex: fotos, docs, root)", "root");
    if (!newFolder) return;

    showToast("Mover", "Movendo...");

    const res = await fetch(`${API_BASE}/files/${fileId}/move`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ folder: newFolder.trim() }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return showToast("Erro", data.error || "Erro ao mover.");

    showToast("Sucesso", `Movido: ${currentName}`);
    loadFiles();
  }

  async function deleteFile(fileId, name) {
    const ok = confirm(`Deseja excluir "${name}"?`);
    if (!ok) return;

    showToast("Excluir", "Excluindo...");

    const res = await fetch(`${API_BASE}/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return showToast("Erro", data.error || "Erro ao excluir.");

    showToast("Sucesso", "Arquivo excluído!");
    loadFiles();
  }

  // ===== Menu (configurações) =====
  function closeAllMenus(exceptMenuEl = null) {
    const menus = document.querySelectorAll(".menu");
    menus.forEach((m) => {
      if (exceptMenuEl && m === exceptMenuEl) return;
      m.classList.remove("open");
    });
  }

  document.addEventListener("click", (e) => {
    // se clicou fora de menu/btn, fecha
    const inside = e.target.closest(".menu") || e.target.closest(".menu-btn");
    if (!inside) closeAllMenus();
  });

  // ===== Render Grid =====
  function renderGrid() {
    if (!gridFilesEl) return;

    const files = getFilteredFiles();
    gridFilesEl.innerHTML = "";

    if (!files.length) {
      const empty = document.createElement("div");
      empty.className = "small";
      empty.textContent = "Nenhum arquivo encontrado.";
      gridFilesEl.appendChild(empty);
      return;
    }

    files.forEach((f) => {
      const name = f.display_name || f.original_name || "Sem nome";
      const isImg = isImageFile(f.mime_type, f.original_name);

      const card = document.createElement("div");
      card.className = "file-card";

      card.innerHTML = `
        <div class="card-top">
          <button class="menu-btn" type="button" aria-label="Configurações">⋮</button>

          <div class="menu">
            <button type="button" class="menu-item" data-action="rename">Renomear</button>
            <button type="button" class="menu-item" data-action="move">Mudar pasta</button>
            <button type="button" class="menu-item danger" data-action="delete">Excluir</button>
          </div>
        </div>

        ${
          isImg
            ? `<img class="thumb" src="${f.public_url}" alt="${name}" />`
            : `<div class="file-icon">📄</div>`
        }

        <div class="thumb-name">${name}</div>
      `;

      // abrir (somente no conteúdo principal, NÃO no menu)
      if (isImg) {
        card.querySelector(".thumb").onclick = () => openPreview(f.public_url, name);
      } else {
        card.querySelector(".file-icon").onclick = () => window.open(f.public_url, "_blank");
      }

      // menu toggle
      const menuBtn = card.querySelector(".menu-btn");
      const menu = card.querySelector(".menu");

      menuBtn.onclick = (e) => {
        e.stopPropagation();
        const willOpen = !menu.classList.contains("open");
        closeAllMenus();
        if (willOpen) menu.classList.add("open");
      };

      // actions
      menu.querySelectorAll(".menu-item").forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          closeAllMenus();

          const action = btn.getAttribute("data-action");

          if (action === "rename") renameFile(f.id, name);
          if (action === "move") moveFile(f.id, name);
          if (action === "delete") deleteFile(f.id, name);
        };
      });

      gridFilesEl.appendChild(card);
    });
  }

  // ===== Load =====
  async function loadFiles() {
    const res = await fetch(`${API_BASE}/files`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast("Erro", data.error || "Erro ao carregar arquivos.");
      allFiles = [];
      updateFolderUI();
      renderFolders(allFiles);
      renderGrid();
      return;
    }

    allFiles = data.files || [];
    updateFolderUI();
    renderFolders(allFiles);
    renderGrid();
  }

  // ===== Upload =====
    // tenta sincronizar ao abrir
  syncUploads();
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
      body: form,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return showToast("Erro", data.error || "Erro no upload.");

    showToast("Sucesso", "Arquivo enviado!");
    if (fileInput) fileInput.value = "";
    loadFiles();
  }

  if (btnUpload) btnUpload.onclick = uploadFile;
  if (searchInput) searchInput.addEventListener("input", renderGrid);

  if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
  // ===== OFFLINE: salva na fila e envia depois =====
    if (!navigator.onLine) {
      await queueUpload({ file, folder });
      showToast("Offline", "Arquivo salvo na fila. Vou enviar quando a internet voltar.");
      if (fileInput) fileInput.value = "";
      return;
    }
    // ===== PWA / Service Worker =====
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  // ===== Offline Upload Queue (IndexedDB) =====
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("meuDriveDB", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("uploadQueue")) {
          db.createObjectStore("uploadQueue", { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function queueUpload({ file, folder }) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("uploadQueue", "readwrite");
      const store = tx.objectStore("uploadQueue");

      const item = {
        id: (crypto?.randomUUID?.() || String(Date.now()) + Math.random()),
        folder: folder || "root",
        name: file.name,
        type: file.type,
        size: file.size,
        createdAt: Date.now(),
        blob: file
      };

      store.put(item);
      tx.oncomplete = () => resolve(item);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getQueuedUploads() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("uploadQueue", "readonly");
      const store = tx.objectStore("uploadQueue");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function removeQueuedUpload(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("uploadQueue", "readwrite");
      tx.objectStore("uploadQueue").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function syncUploads() {
    if (!navigator.onLine) return;

    const items = await getQueuedUploads();
    if (!items.length) return;

    // Se quiser, dá pra mostrar o total
    showToast("Sincronizando", `Enviando ${items.length} arquivo(s)...`);

    for (const item of items) {
      try {
        const form = new FormData();
        form.append("file", item.blob, item.name);
        form.append("folder", item.folder || "root");

        const res = await fetch(`${API_BASE}/files/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form
        });

        if (res.ok) {
          await removeQueuedUpload(item.id);
        } else {
          // se falhar, para e tenta depois
          break;
        }
      } catch {
        break;
      }
    }

    showToast("Ok", "Sincronização concluída (ou pausada).");
    loadFiles();
  }

  window.addEventListener("online", () => syncUploads());


  // Start
  loadFiles();
});
