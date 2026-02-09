const SUPABASE_URL = "COLE_AQUI_SUPABASE_URL";
const SUPABASE_ANON_KEY = "COLE_AQUI_SUPABASE_ANON_KEY";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const msg = document.getElementById("msg");

document.getElementById("btnRegister").onclick = async () => {
  msg.textContent = "Registrando...";
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPass").value;

  const { error } = await supabase.auth.signUp({ email, password });
  msg.textContent = error ? error.message : "Conta criada! Agora faça login.";
};

document.getElementById("btnLogin").onclick = async () => {
  msg.textContent = "Entrando...";
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPass").value;

  // login email/senha :contentReference[oaicite:4]{index=4}
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return (msg.textContent = error.message);

  // guarda token pro dashboard
  localStorage.setItem("access_token", data.session.access_token);
  window.location.href = "./dashboard.html";
};
