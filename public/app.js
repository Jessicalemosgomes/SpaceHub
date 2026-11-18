const API = "/api";
let token = localStorage.getItem("spacehub_token");
let currentUser = JSON.parse(localStorage.getItem("spacehub_user") || "null");
const $ = id => document.getElementById(id);
const modal = $("modal"), modalContent = $("modalContent");
const headers = () => token ? { Authorization: `Bearer ${token}` } : {};
async function api(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: { ...headers(), ...(options.body instanceof FormData ? {} : {"Content-Type":"application/json"}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}
function message(text, error=false) { $("notice").textContent = text; $("notice").style.color = error ? "#b54747" : "#26845a"; }
function openModal(html) { modalContent.innerHTML = html; modal.classList.remove("hidden"); }
function closeModal() { modal.classList.add("hidden"); }
$("closeModal").onclick = closeModal;
modal.onclick = e => { if (e.target === modal) closeModal(); };
function authModal(mode="login") {
  const register = mode === "register";
  openModal(`<h2>${register ? "Crie sua conta" : "Bem-vindo de volta"}</h2>
  <form class="form" id="authForm">
    ${register ? `<label>Nome<input name="name" required minlength="2"></label>` : ""}
    <label>E-mail<input name="email" type="email" required></label>
    <label>Senha<input name="password" type="password" minlength="8" required></label>
    ${register ? `<label>Quero usar o SpaceHub como<select name="role"><option value="GUEST">Hóspede — reservar espaços</option><option value="HOST">Anfitrião — anunciar espaços</option></select></label>` : ""}
    <button class="btn btn-primary">${register ? "Criar conta" : "Entrar"}</button>
    <p class="muted">${register ? "Já tem conta?" : "Ainda não tem conta?"} <a href="#" id="switchAuth">${register ? "Entrar" : "Criar conta"}</a></p>
  </form>`);
  $("switchAuth").onclick = e => { e.preventDefault(); authModal(register ? "login" : "register"); };
  $("authForm").onsubmit = async e => {
    e.preventDefault(); const body = Object.fromEntries(new FormData(e.target));
    try {
      const result = await api(`/auth/${register ? "register" : "login"}`, {method:"POST", body:JSON.stringify(body)});
      token = result.token; currentUser = result.user;
      localStorage.setItem("spacehub_token", token); localStorage.setItem("spacehub_user", JSON.stringify(currentUser));
      $("authBtn").textContent = "Sair"; closeModal(); message(`Olá, ${currentUser.name}!`); loadSpaces();
    } catch(err) { message(err.message, true); }
  };
}
$("authBtn").onclick = () => { if (currentUser) { token=null; currentUser=null; localStorage.removeItem("spacehub_token"); localStorage.removeItem("spacehub_user"); $("authBtn").textContent="Entrar"; message("Você saiu da sua conta."); } else authModal(); };
function queryString() {
  const p = new URLSearchParams();
  if ($("searchLocation").value.trim()) p.set("location", $("searchLocation").value.trim());
  if ($("startDate").value) p.set("startDate", $("startDate").value);
  if ($("endDate").value) p.set("endDate", $("endDate").value);
  ["wifi","meetingRoom","entirePlace"].forEach(k => { if ($(k).checked) p.set(k,"true"); });
  return p.toString();
}
async function loadSpaces() {
  $("spacesGrid").innerHTML = `<div class="empty">Buscando espaços...</div>`;
  try {
    const spaces = await api("/spaces?" + queryString());
    if (!spaces.length) { $("spacesGrid").innerHTML = `<div class="empty">Nenhum espaço encontrado. Experimente alterar os filtros.</div>`; return; }
    $("spacesGrid").innerHTML = spaces.map(s => {
      const photo = s.photos?.[0]?.url || "";
      const tags = [s.wifi && "Wi-Fi", s.meetingRoom && "Sala de reunião", s.entirePlace && "Espaço inteiro"].filter(Boolean);
      return `<article class="space-card">
        ${photo ? `<img class="space-photo" src="${photo}" alt="${escapeHtml(s.title)}">` : `<div class="space-photo"></div>`}
        <div class="space-info"><h3>${escapeHtml(s.title)}</h3><div class="muted">⌖ ${escapeHtml(s.location)}</div>
        <div class="tags">${tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
        <div class="price-row"><div class="price">R$ ${Number(s.pricePerNight).toFixed(2).replace(".",",")} <small>/ noite</small></div>
       <button class="btn btn-primary" data-action="view-space" data-space-id="${s.id}">Ver espaço</button></div></div></article>`;
    }).join("");
  } catch(err) { $("spacesGrid").innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`; }
}
function escapeHtml(s="") { return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
window.showSpace = async id => {
  try {
    const s = await api("/spaces/"+id);
    const photo = s.photos?.[0]?.url;
    openModal(`<h2>${escapeHtml(s.title)}</h2>${photo?`<img src="${photo}" style="width:100%;height:190px;object-fit:cover;border-radius:12px">`:""}
      <p class="muted">⌖ ${escapeHtml(s.location)} · Anfitrião: ${escapeHtml(s.host.name)}</p><p>${escapeHtml(s.description)}</p>
      <div class="tags">${[s.wifi&&"Wi-Fi",s.meetingRoom&&"Sala de reunião",s.entirePlace&&"Espaço inteiro"].filter(Boolean).map(x=>`<span class="tag">${x}</span>`).join("")}</div>
      <div class="booking-box"><strong>R$ ${Number(s.pricePerNight).toFixed(2).replace(".",",")} / noite</strong>
      <form class="form" id="bookingForm"><div class="form-row"><label>Check-in<input name="startDate" type="date" required></label><label>Check-out<input name="endDate" type="date" required></label></div><button class="btn btn-primary">Solicitar reserva</button></form></div>`);
    $("bookingForm").onsubmit = async e => {
      e.preventDefault();
      if (!currentUser) return authModal();
      if (currentUser.role !== "GUEST") return message("Entre com uma conta de hóspede para reservar.", true);
      const dates = Object.fromEntries(new FormData(e.target));
      try {
        const booking = await api("/bookings", {method:"POST",body:JSON.stringify({spaceId:id,...dates})});
        message(`Reserva confirmada! Total: R$ ${Number(booking.total).toFixed(2).replace(".",",")}.`);
        closeModal(); loadSpaces();
      } catch(err) { message(err.message,true); }
    };
  } catch(err) { message(err.message,true); }
};
$("searchBtn").onclick = loadSpaces;
["wifi","meetingRoom","entirePlace"].forEach(k => $(k).onchange = loadSpaces);
$("myBookingsBtn").onclick = async () => {
  if (!currentUser) return authModal();
  if (currentUser.role !== "GUEST") return message("Esta área é destinada a contas de hóspede.",true);
  try {
    const bookings = await api("/bookings/mine");
    openModal(`<h2>Minhas reservas</h2>${bookings.length ? bookings.map(b=>`<div class="list-item"><strong>${escapeHtml(b.space.title)}</strong>${b.startDate.slice(0,10)} → ${b.endDate.slice(0,10)} · R$ ${Number(b.total).toFixed(2).replace(".",",")}<br><span class="muted">${b.status==="CONFIRMED"?"Confirmada":"Cancelada"}</span>${b.status==="CONFIRMED"?`<button class="btn btn-outline" style="float:right" data-action="cancel-booking" data-booking-id="${b.id}">Cancelar</button>`:""}</div>`).join("") : `<p class="muted">Você ainda não tem reservas.</p>`}`);
  } catch(err) { message(err.message,true); }
};
window.cancelBooking = async id => { try { await api(`/bookings/${id}/cancel`,{method:"PATCH",body:"{}"}); $("myBookingsBtn").click(); message("Reserva cancelada."); } catch(err) { message(err.message,true); } };
$("hostBtn").onclick = async () => {
  if (!currentUser) return authModal();
  if (currentUser.role !== "HOST") return message("Entre com uma conta de anfitrião para acessar o painel.",true);
  try {
    const spaces = await api("/spaces/mine");
    openModal(`<h2>Painel do anfitrião</h2><button class="btn btn-primary" id="newSpaceBtn">+ Cadastrar espaço</button><div style="margin-top:16px">${spaces.map(s=>`<div class="list-item"><strong>${escapeHtml(s.title)}</strong>${escapeHtml(s.location)} · R$ ${Number(s.pricePerNight).toFixed(2)} / noite <button class="btn btn-outline" style="float:right" data-action="delete-space" data-space-id="${s.id}">Excluir</button></div>`).join("") || `<p class="muted">Você ainda não anunciou espaços.</p>`}</div>`);
    $("newSpaceBtn").onclick = createSpaceForm;
  } catch(err) { message(err.message,true); }
};
function createSpaceForm() {
  openModal(`<h2>Novo espaço</h2><form class="form" id="spaceForm" enctype="multipart/form-data">
  <label>Título<input name="title" required minlength="3"></label><label>Descrição<textarea name="description" required minlength="10"></textarea></label>
  <label>Localização<input name="location" required placeholder="Cidade, bairro"></label>
  <div class="form-row"><label>Preço por noite (R$)<input name="pricePerNight" type="number" min="1" step=".01" required></label><label>Fotos<input name="photos" type="file" accept="image/png,image/jpeg,image/webp" multiple required></label></div>
  <div class="form-checks"><label><input type="checkbox" name="wifi" value="true"> Wi-Fi</label><label><input type="checkbox" name="meetingRoom" value="true"> Sala de reunião</label><label><input type="checkbox" name="entirePlace" value="true"> Espaço inteiro</label></div>
  <button class="btn btn-primary">Publicar espaço</button></form>`);
  $("spaceForm").onsubmit = async e => { e.preventDefault(); const fd = new FormData(e.target); ["wifi","meetingRoom","entirePlace"].forEach(k=>fd.set(k,e.target.elements[k].checked?"true":"false"));
    try { await api("/spaces",{method:"POST",body:fd}); message("Espaço publicado com sucesso!"); closeModal(); loadSpaces(); } catch(err) { message(err.message,true); }
  };
}
window.deleteSpace = async id => { if (!confirm("Excluir este anúncio?")) return; try { await api("/spaces/"+id,{method:"DELETE"}); $("hostBtn").click(); loadSpaces(); } catch(err) { message(err.message,true); } };
document.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;

  if (action === "view-space") {
    window.showSpace(button.dataset.spaceId);
  }

  if (action === "cancel-booking") {
    window.cancelBooking(button.dataset.bookingId);
  }

  if (action === "delete-space") {
    window.deleteSpace(button.dataset.spaceId);
  }
});
if (currentUser) $("authBtn").textContent="Sair";
const today = new Date().toISOString().slice(0,10); $("startDate").min=today; $("endDate").min=today;
$("startDate").onchange=()=>{$("endDate").min=$("startDate").value;};
loadSpaces();
