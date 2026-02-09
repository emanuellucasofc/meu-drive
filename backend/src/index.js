import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

// Render exige bind em 0.0.0.0 e porta do env PORT
const PORT = process.env.PORT || 3000;

// ENV do Supabase (colocar no Render depois)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "uploads";

// Cliente "admin" (service role) -> pode escrever no Storage e no DB
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Upload em memória (não salva no disco do Render)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BLOCKED_EXT = [".exe", ".bat", ".cmd", ".msi", ".sh", ".js"];

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


// Middleware: valida usuário pelo token do Supabase
async function requireUser(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Sem token" });

    // valida token pedindo o usuário ao Supabase Auth
    const supabaseUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data, error } = await supabaseUserClient.auth.getUser();
    if (error || !data?.user) return res.status(401).json({ error: "Token inválido" });

    req.user = data.user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Falha na autenticação" });
  }
}

// Health check
app.get("/", (_, res) => res.send("OK - API Meu Drive"));

// Listar arquivos do usuário logado
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

// Upload
app.post("/files/upload", requireUser, upload.single("file"), async (req, res) => {
  const userId = req.user.id;
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Envie um arquivo no campo 'file'." });

  // path único no bucket
  const folderRaw = (req.body.folder || "root").toString();
const folder = folderRaw.replace(/[^a-zA-Z0-9-_]/g, "").trim() || "root";

const safeName = file.originalname.replace(/\s+/g, "_");
const storagePath = `${userId}/${folder}/${Date.now()}_${safeName}`;


  // envia pro Supabase Storage
  const { error: upErr } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (upErr) return res.status(500).json({ error: upErr.message });

  // pega URL pública (bucket público)
  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = pub.publicUrl; // URL pública do arquivo :contentReference[oaicite:2]{index=2}

  // salva metadados no Postgres
  const { data, error: dbErr } = await supabaseAdmin
    .from("files")
    .insert([{
      user_id: userId,
      original_name: file.originalname,
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

// Deletar
app.delete("/files/:id", requireUser, async (req, res) => {
  const userId = req.user.id;
  const id = req.params.id;

  // pega o arquivo e garante que é do user
  const { data: row, error: getErr } = await supabaseAdmin
    .from("files")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (getErr || !row) return res.status(404).json({ error: "Arquivo não encontrado" });

  // remove do storage
  const { error: rmErr } = await supabaseAdmin.storage.from(BUCKET).remove([row.storage_path]);
  if (rmErr) return res.status(500).json({ error: rmErr.message });

  // remove do banco
  const { error: delErr } = await supabaseAdmin.from("files").delete().eq("id", id);
  if (delErr) return res.status(500).json({ error: delErr.message });

  return res.json({ ok: true });
});
// Tratamento de erro do multer (tamanho/arquivo inválido)
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
