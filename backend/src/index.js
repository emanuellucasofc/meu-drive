import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// ===== ENV =====
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "meu-drive";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltam variáveis: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
}

// cliente admin (Storage + DB)
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ===== Auth helper (valida token do usuário) =====
async function getUserFromToken(token) {
  if (!token) return null;

  // cria um client com header Authorization do usuário
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error) return null;
  return data.user;
}

function getBearer(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return null;
  return h.slice(7).trim();
}

// ===== Health =====
app.get("/", (req, res) => res.send("OK - API Meu Drive"));

// ===== LIST FILES =====
app.get("/files", async (req, res) => {
  try {
    const token = getBearer(req);
    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Não autorizado" });

    const { data, error } = await admin
      .from("files")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ files: data || [] });
  } catch (e) {
    return res.status(500).json({ error: "Erro interno" });
  }
});

// ===== UPLOAD =====
app.post("/files/upload", upload.single("file"), async (req, res) => {
  try {
    const token = getBearer(req);
    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Não autorizado" });

    const file = req.file;
    const folderRaw = (req.body.folder || "root").trim();
    const folder = folderRaw ? folderRaw : "root";

    if (!file) return res.status(400).json({ error: "Arquivo não enviado" });

    // nome final (mantém original, mas evita conflito colocando timestamp)
    const safeName = (file.originalname || "arquivo").replace(/[^\w.\-() ]+/g, "_");
    const filename = `${Date.now()}-${safeName}`;

    // caminho: userId/folder/filename
    const storagePath = `${user.id}/${folder}/${filename}`;

    const { error: upErr } = await admin.storage
      .from(SUPABASE_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (upErr) return res.status(500).json({ error: upErr.message });

    const { data: pub } = admin.storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
    const publicUrl = pub?.publicUrl || null;

    const { data: inserted, error: insErr } = await admin
      .from("files")
      .insert([
        {
          user_id: user.id,
          original_name: file.originalname,
          display_name: null,
          storage_path: storagePath,
          public_url: publicUrl,
          size: file.size,
          mime_type: file.mimetype,
        },
      ])
      .select("*")
      .single();

    if (insErr) return res.status(500).json({ error: insErr.message });

    return res.json({ file: inserted });
  } catch (e) {
    return res.status(500).json({ error: "Erro interno" });
  }
});

// ===== RENAME (display_name) =====
app.patch("/files/:id/rename", async (req, res) => {
  try {
    const token = getBearer(req);
    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Não autorizado" });

    const id = req.params.id;
    const display_name = (req.body.display_name || "").trim();
    if (!display_name) return res.status(400).json({ error: "Nome inválido" });

    const { data: updated, error } = await admin
      .from("files")
      .update({ display_name })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ file: updated });
  } catch (e) {
    return res.status(500).json({ error: "Erro interno" });
  }
});

// ===== MOVE (Storage + DB) =====
app.patch("/files/:id/move", async (req, res) => {
  try {
    const token = getBearer(req);
    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Não autorizado" });

    const id = req.params.id;
    const newFolderRaw = (req.body.folder || "").trim();
    const newFolder = newFolderRaw ? newFolderRaw : "root";

    // pega registro
    const { data: fileRow, error: getErr } = await admin
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (getErr || !fileRow) return res.status(404).json({ error: "Arquivo não encontrado" });

    const oldPath = fileRow.storage_path;
    if (!oldPath) return res.status(400).json({ error: "storage_path inválido" });

    // oldPath: userId/oldFolder/rest...
    const parts = String(oldPath).split("/");
    if (parts.length < 3) return res.status(400).json({ error: "storage_path inesperado" });

    const userIdPart = parts[0];
    const rest = parts.slice(2).join("/"); // mantém nome do arquivo
    const newPath = `${userIdPart}/${newFolder}/${rest}`;

    // move no storage
    const { error: mvErr } = await admin.storage.from(SUPABASE_BUCKET).move(oldPath, newPath);
    if (mvErr) return res.status(500).json({ error: mvErr.message });

    // novo public url
    const { data: pub } = admin.storage.from(SUPABASE_BUCKET).getPublicUrl(newPath);
    const publicUrl = pub?.publicUrl || null;

    // atualiza DB
    const { data: updated, error: upErr } = await admin
      .from("files")
      .update({ storage_path: newPath, public_url: publicUrl })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (upErr) return res.status(500).json({ error: upErr.message });

    return res.json({ file: updated });
  } catch (e) {
    return res.status(500).json({ error: "Erro interno" });
  }
});

// ===== DELETE (Storage + DB) =====
app.delete("/files/:id", async (req, res) => {
  try {
    const token = getBearer(req);
    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Não autorizado" });

    const id = req.params.id;

    const { data: fileRow, error: getErr } = await admin
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (getErr || !fileRow) return res.status(404).json({ error: "Arquivo não encontrado" });

    const storagePath = fileRow.storage_path;

    if (storagePath) {
      const { error: rmErr } = await admin.storage.from(SUPABASE_BUCKET).remove([storagePath]);
      if (rmErr) return res.status(500).json({ error: rmErr.message });
    }

    const { error: delErr } = await admin.from("files").delete().eq("id", id).eq("user_id", user.id);
    if (delErr) return res.status(500).json({ error: delErr.message });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Erro interno" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API rodando na porta", PORT));
