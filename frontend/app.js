// ===== CONFIGURAÇÃO SUPABASE =====
const SUPABASE_URL = "https://pwhhoorrdcjwodwwhakx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3aGhvb3JyZGNqd29kd3doYWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODcxNDIsImV4cCI6MjA4NjE2MzE0Mn0.pMRPL8BPmE1kS4FABsyRcazwliBz9XetTAEOugqZh0k";

// IMPORTANTÍSSIMO: não use variável chamada "supabase"
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const msg = document.getElementById("msg");

// REGISTRO
document.getElementById("btnRegister").addEventListener("click", async () => {
  msg.textContent = "Registrando...";

  const email = document.getElementById("regEmail").value.trim().toLowerCase();
  const password = document.getElementById("regPass").value.trim();

  if (!email || !email.includes("@") || !email.includes(".")) {
    msg.textContent = "Digite um email válido (ex: nome@gmail.com)";
    return;
  }
  if (!password || password.length < 6) {
    msg.textContent = "A senha precisa ter no mínimo 6 caracteres.";
    return;
  }

  const { error } = await sb.auth.signUp({ email, password });
  msg.textContent = error ? error.message : "Conta criada! Agora faça login.";
});

// LOGIN
document.getElementById("btnLogin").addEventListener("click", async () => {
  msg.textContent = "Entrando...";

  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPass").value.trim();

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return (msg.textContent = error.message);

  localStorage.setItem("access_token", data.session.access_token);
  window.location.href = "./dashboard.html";
});
