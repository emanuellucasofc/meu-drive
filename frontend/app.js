const SUPABASE_URL = "https://pwhhoorrdcjwodwwhakx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3aGhvb3JyZGNqd29kd3doYWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODcxNDIsImV4cCI6MjA4NjE2MzE0Mn0.pMRPL8BPmE1kS4FABsyRcazwliBz9XetTAEOugqZh0k";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const msg = document.getElementById("msg");

document.getElementById("btnRegister").onclick = async () => {
  msg.textContent = "Registrando...";
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPass").value;

  const { error } = await sb.auth.signUp({ email, password });
  msg.textContent = error ? error.message : "Conta criada! Agora faça login.";
};

document.getElementById("btnLogin").onclick = async () => {
  msg.textContent = "Entrando...";
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPass").value;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return (msg.textContent = error.message);

  localStorage.setItem("access_token", data.session.access_token);
  window.location.href = "./dashboard.html";
};
