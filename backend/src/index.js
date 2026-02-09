import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "uploads";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ENV faltando: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
}

// Admin client (service role) — fácil para MVP
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ===== LIMITES E BLOQUEIOS =====
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BLOCKED_EXT = [".exe", ".bat", ".cmd", ".msi", ".sh", ".js"];

// Upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const blocked = BLOCKED_EXT.some(ext => name.endsWith(ext));
    if (blocked) return cb(new Error("Tipo de arquivo não permitido."));
    cb(null, true);
  }
});

// ===== AUTH MIDDLEWARE =====
async function requireUser(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Sem token" });

    const supabaseUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data, error } = await supabaseUserClient.auth.getUser();
    if (error || !data?.user) return res.status(401).json({ error: "Token inválido" });

    req.user = data.user;
    next();
  } catch {
    return res.status(401).json({ error: "Falha na autenticação" });
  }
}

// Health
app.get("/", (_, res) => res.send("OK - API Meu Drive"));

// ===== LISTAR ARQUIVOS =====
app.get("/files", requireUser, async (req, res) => {
  const userId = req.user.id;

  const { data, error } = await supabaseAdmin
    .from("files")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ files: data });
});

// ===== UPLOAD =====
app.post("/files/upload", requireUser, upload.single("file"), async (req, res) => {
  const userId = req.user.id;
  const file = req.file;

  if (!file) return res.status(400).json({ error: "Envie um arquivo no campo 'file'." });

  // pasta (opcional)
  const folderRaw = (req.body.folder || "root").toString();
  const folder = folderRaw.replace(/[^a-zA-Z0-9-_]/g, "").trim() || "root";

  const safeName = file.originalname.replace(/\s+/g, "_");
  const storagePath = `${userId}/${folder}/${Date.now()}_${safeName}`;

  // envia pro storage
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (upErr) return res.status(500).json({ error: upErr.message });

  // URL pública (bucket público)
  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = pub.publicUrl;

  // salva no banco
  const { data, error: dbErr } = await supabaseAdmin
    .from("files")
    .insert([{
      user_id: userId,
      original_name: file.originalname,
      display_name: file.originalname,  // rename
      storage_path: storagePath,
      public_url: publicUrl,
      size: file.size,
      mime_type: file.mimetype
    }])
    .select()
    .single();

  if (dbErr) return res.status(500).json({ error: dbErr.message });

  return res.json({ file: data });
});

// ===== RENOMEAR (somente no banco) =====
app.patch("/files/:id/rename", requireUser, async (req, res) => {
  const userId = req.user.id;
  const id = req.params.id;
  const displayName = (req.body.display_name || "").toString().trim();

  if (!displayName) return res.status(400).json({ error: "Nome inválido." });

  const { data, error } = await supabaseAdmin
    .from("files")
    .update({ display_name: displayName })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ file: data });
});

// ===== DELETE =====
app.delete("/files/:id", requireUser, async (req, res) => {
  const userId = req.user.id;
  const id = req.params.id;

  const { data: row, error: getErr } = await supabaseAdmin
    .from("files")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (getErr || !row) return res.status(404).json({ error: "Arquivo não encontrado" });

  const { error: rmErr } = await supabaseAdmin.storage.from(BUCKET).remove([row.storage_path]);
  if (rmErr) return res.status(500).json({ error: rmErr.message });

  const { error: delErr } = await supabaseAdmin.from("files").delete().eq("id", id);
  if (delErr) return res.status(500).json({ error: delErr.message });

  return res.json({ ok: true });
});

// ===== TRATAMENTO DE ERROS (MULTER) =====
app.use((err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Arquivo muito grande (máx 10MB)." });
  }
  if (err?.message === "Tipo de arquivo não permitido.") {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

app.listen(PORT, "0.0.0.0", () => console.log("API rodando na porta", PORT));
