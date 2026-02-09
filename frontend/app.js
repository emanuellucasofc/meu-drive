const SUPABASE_URL = "https://pwhhoorrdcjwodwwhakx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3aGhvb3JyZGNqd29kd3doYWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODcxNDIsImV4cCI6MjA4NjE2MzE0Mn0.pMRPL8BPmE1kS4FABsyRcazwliBz9XetTAEOugqZh0k";

// cria cliente Supabase (somente 1 vez)
const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ===== ELEMENTOS DA TELA =====
const msg = document.getElementById("msg");

// ===== REGISTRO =====
document.getElementById("btnRegister").addEventListener("click", async () => {
  msg.textContent = "Registrando...";

  const email = document
    .getElementById("regEmail")
    .value.trim()
    .toLowerCase();

  const password = document
    .getElementById("regPass")
    .value.trim();

  // validações básicas
  if (!email || !email.includes("@") || !email.includes(".")) {
    msg.textContent = "Digite um email válido (ex: nome@gmail.com)";
    return;
  }

  if (!password || password.length < 6) {
    msg.textContent = "A senha precisa ter no mínimo 6 caracteres.";
    return;
  }

  const { error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    msg.textContent = error.message;
  } else {
    msg.textContent = "Conta criada com sucesso! Agora faça login.";
  }
});

// ===== LOGIN =====
document.getElementById("btnLogin").addEventListener("click", async () => {
  msg.textContent = "Entrando...";

  const email = document
    .getElementById("loginEmail")
    .value.trim()
    .toLowerCase();

  const password = document
    .getElementById("loginPass")
    .value.trim();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    msg.textContent = error.message;
    return;
  }

  // salva token para usar no dashboard
  localStorage.setItem(
    "access_token",
    data.session.access_token
  );

  // redireciona
  window.location.href = "./dashboard.html";
});
