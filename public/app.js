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

window.escapeHtml = function(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
};

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




window.guestCalendarState = null;

window.renderGuestCalendar = () => {
  const state = window.guestCalendarState;
  if (!state) return;

  const { month, year, bookings, blocks } = state;

  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  let html = "";

  for (let i = 0; i < 42; i++) {
    const day = i - firstDay + 1;

    if (day < 1 || day > daysInMonth) {
      html += `<div></div>`;
      continue;
    }

    const date = new Date(Date.UTC(year, month, day))
      .toISOString().slice(0, 10);

    const reserved = bookings.some(b =>
      date >= b.startDate.slice(0, 10) &&
      date < b.endDate.slice(0, 10)
    );

    const blocked = blocks.some(b =>
      date >= b.startDate.slice(0, 10) &&
      date < b.endDate.slice(0, 10)
    );

    const background = reserved
      ? "#fee2e2"
      : blocked
        ? "#fef3c7"
        : "#dcfce7";

    html += `
      <div title="${reserved ? "Reservado" : blocked ? "Bloqueado" : "Disponível"}"
        style="background:${background};padding:10px 2px;
        border-radius:8px;text-align:center;font-size:13px;
        min-height:40px">
        <strong>${day}</strong>
      </div>
    `;
  }

  $("guestCalendarMonth").textContent =
    new Date(year, month, 1).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric"
    });

  $("guestCalendar").innerHTML = html;
};

window.changeGuestCalendarMonth = direction => {
  const state = window.guestCalendarState;
  if (!state) return;

  state.month += direction;

  if (state.month > 11) {
    state.month = 0;
    state.year++;
  } else if (state.month < 0) {
    state.month = 11;
    state.year--;
  }

  window.renderGuestCalendar();
};

window.showSpace = async id => {
  try {
    const [s, calendar] = await Promise.all([
      api("/spaces/" + id),
      api("/calendar/" + id)
    ]);

    window.guestCalendarState = {
      bookings: calendar.bookings,
      blocks: calendar.blocks,
      month: new Date().getMonth(),
      year: new Date().getFullYear()
    };

    const photo = s.photos?.[0]?.url;

    openModal(`
      <h2>${escapeHtml(s.title)}</h2>

      ${photo ? `
        <img src="${photo}"
          style="width:100%;height:190px;object-fit:cover;border-radius:12px">
      ` : ""}

      <p class="muted">
        ⌖ ${escapeHtml(s.location)}
        · Anfitrião: ${escapeHtml(s.host.name)}
      </p>

      <p>${escapeHtml(s.description)}</p>

      <div class="tags">
        ${[
          s.wifi && "Wi-Fi",
          s.meetingRoom && "Sala de reunião",
          s.entirePlace && "Espaço inteiro"
        ].filter(Boolean).map(x => `<span class="tag">${x}</span>`).join("")}
      </div>

      <div style="margin:22px 0">
        <h3>Calendário de disponibilidade</h3>

        <div style="display:flex;justify-content:space-between;
          align-items:center;margin:15px 0">
          <button class="btn btn-outline" data-action="guest-calendar-prev">‹</button>
          <strong id="guestCalendarMonth"></strong>
          <button class="btn btn-outline" data-action="guest-calendar-next">›</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(7,1fr);
          gap:5px;text-align:center;margin-bottom:8px">
          ${["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]
            .map(d => `<strong style="font-size:12px">${d}</strong>`).join("")}
        </div>

        <div id="guestCalendar"
          style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px">
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap;
          font-size:12px;margin-top:14px">
          <span>🟢 Disponível</span>
          <span>🔴 Reservado</span>
          <span>🟡 Bloqueado</span>
        </div>
      </div>

      <div class="booking-box">
        <strong>
          R$ ${Number(s.pricePerNight).toFixed(2).replace(".",",")} / noite
        </strong>

        <form class="form" id="bookingForm">
          <div class="form-row">
            <label>
              Check-in
              <input name="startDate" type="date" required>
            </label>

            <label>
              Check-out
              <input name="endDate" type="date" required>
            </label>
          </div>

          <button class="btn btn-primary">Solicitar reserva</button>
        </form>
      </div>
    `);

    window.renderGuestCalendar();

    $("bookingForm").onsubmit = async e => {
      e.preventDefault();

      if (!currentUser) return authModal();

      if (currentUser.role !== "GUEST") {
        return message("Entre com uma conta de hóspede para reservar.", true);
      }

      const dates = Object.fromEntries(new FormData(e.target));

      if (!dates.startDate || !dates.endDate ||
          dates.startDate >= dates.endDate) {
        return message("Informe um período válido.", true);
      }

      const state = window.guestCalendarState;

      const conflict = [...state.bookings, ...state.blocks].some(item =>
        dates.startDate < item.endDate.slice(0, 10) &&
        dates.endDate > item.startDate.slice(0, 10)
      );

      if (conflict) {
        return message(
          "Este período contém datas reservadas ou bloqueadas. Escolha outras datas.",
          true
        );
      }

      try {
        const booking = await api("/bookings", {
          method: "POST",
          body: JSON.stringify({ spaceId: id, ...dates })
        });

        closeModal();

        message(
          `Reserva confirmada! Total: R$ ${Number(booking.total).toFixed(2).replace(".",",")}.`
        );

        loadSpaces();
      } catch (err) {
        message(err.message, true);
      }
    };

  } catch (err) {
    message(err.message, true);
  }
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

window.calendarState = null;

window.manageCalendar = async (spaceId) => {
  try {
    const data = await api(`/calendar/${spaceId}`);

    window.calendarState = {
      spaceId,
      bookings: data.bookings,
      blocks: data.blocks,
      month: new Date().getMonth(),
      year: new Date().getFullYear()
    };

    window.renderCalendar();
  } catch (err) {
    message(err.message, true);
  }
};

window.renderCalendar = () => {
  const state = window.calendarState;
  if (!state) return;

  const { month, year, bookings, blocks } = state;

  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const dateString = (day) =>
    new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);

  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  let daysHTML = "";

  for (let i = 0; i < 42; i++) {
    const day = i - firstDay + 1;

    if (day < 1 || day > daysInMonth) {
      daysHTML += `<div></div>`;
      continue;
    }

    const date = dateString(day);

    const reserved = bookings.some(b =>
      date >= b.startDate.slice(0, 10) &&
      date < b.endDate.slice(0, 10)
    );

    const blocked = blocks.some(b =>
      date >= b.startDate.slice(0, 10) &&
      date < b.endDate.slice(0, 10)
    );

    const status = reserved ? "Reservado" : blocked ? "Bloqueado" : "Disponível";

    const background = reserved
      ? "#fee2e2"
      : blocked
        ? "#fef3c7"
        : "#dcfce7";

    daysHTML += `
      <div title="${status}: ${date}"
        style="background:${background};padding:10px 2px;
        border-radius:8px;text-align:center;font-size:13px;
        min-height:42px">
        <strong>${day}</strong>
      </div>
    `;
  }

  const monthName = new Date(year, month, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  openModal(`
    <div class="calendar-view">
      <h2>Gerenciar disponibilidade</h2>

      <div style="display:flex;justify-content:space-between;
        align-items:center;margin:20px 0">
        <button class="btn btn-outline" data-action="calendar-prev">‹</button>
        <strong>${monthName}</strong>
        <button class="btn btn-outline" data-action="calendar-next">›</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(7,1fr);
        gap:5px;text-align:center;margin-bottom:8px">
        ${weekdays.map(d => `<strong style="font-size:12px">${d}</strong>`).join("")}
      </div>

      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px">
        ${daysHTML}
      </div>

      <div style="display:flex;gap:12px;flex-wrap:wrap;
        font-size:12px;margin:15px 0">
        <span>🟢 Disponível</span>
        <span>🔴 Reservado</span>
        <span>🟡 Bloqueado</span>
      </div>

      <hr>

      <h3>Bloquear datas</h3>
      <p class="muted" style="font-size:13px">
        A data final não é incluída no bloqueio, assim como no checkout.
      </p>

      <div class="form">
        <label>Data inicial</label>
        <input type="date" id="blockStart">

        <label>Data final</label>
        <input type="date" id="blockEnd">

        <label>Motivo (opcional)</label>
        <input type="text" id="blockReason" maxlength="180"
          placeholder="Ex.: Manutenção">

        <button class="btn btn-primary" data-action="create-calendar-block">
          Bloquear período
        </button>
      </div>

      <hr>

      <h3>Bloqueios cadastrados</h3>

      ${blocks.map(b => `
        <div class="list-item">
          <strong>
            ${b.startDate.slice(0,10)} até ${b.endDate.slice(0,10)}
          </strong>
          ${escapeHtml(b.reason || "Sem motivo informado")}
          <button class="btn btn-outline"
            data-action="remove-calendar-block"
            data-block-id="${b.id}">
            Remover bloqueio
          </button>
        </div>
      `).join("") || `<p class="muted">Nenhum bloqueio cadastrado.</p>`}
    </div>
  `);

  modal.querySelector(".modal-card").style.width = "min(760px, 100%)";
};

window.changeCalendarMonth = (direction) => {
  const state = window.calendarState;
  if (!state) return;

  state.month += direction;

  if (state.month > 11) {
    state.month = 0;
    state.year++;
  } else if (state.month < 0) {
    state.month = 11;
    state.year--;
  }

  window.renderCalendar();
};

window.createCalendarBlock = async () => {
  const state = window.calendarState;
  const startDate = $("blockStart").value;
  const endDate = $("blockEnd").value;
  const reason = $("blockReason").value.trim();

  if (!startDate || !endDate || startDate >= endDate) {
    return message("Informe um período válido.", true);
  }

  try {
    await api(`/calendar/${state.spaceId}/blocks`, {
      method: "POST",
      body: JSON.stringify({ startDate, endDate, reason })
    });

    message("Período bloqueado com sucesso!");
    await window.manageCalendar(state.spaceId);
  } catch (err) {
    message(err.message, true);
  }
};

window.removeCalendarBlock = async (blockId) => {
  const state = window.calendarState;

  if (!confirm("Deseja realmente remover este bloqueio?")) return;

  try {
    await api(`/calendar/blocks/${blockId}`, {
      method: "DELETE"
    });

    message("Bloqueio removido com sucesso!");
    await window.manageCalendar(state.spaceId);
  } catch (err) {
    message(err.message, true);
  }
};
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

if (action === "manage-calendar") {
  window.manageCalendar(button.dataset.spaceId);
}

if (action === "calendar-prev") {
  window.changeCalendarMonth(-1);
}

if (action === "calendar-next") {
  window.changeCalendarMonth(1);
}

if (action === "create-calendar-block") {
  window.createCalendarBlock();
}

if (action === "remove-calendar-block") {
  window.removeCalendarBlock(button.dataset.blockId);
}

if (action === "guest-calendar-prev") {
  window.changeGuestCalendarMonth(-1);
}

if (action === "guest-calendar-next") {
  window.changeGuestCalendarMonth(1);
}
});
if (currentUser) $("authBtn").textContent="Sair";
const today = new Date().toISOString().slice(0,10); $("startDate").min=today; $("endDate").min=today;
$("startDate").onchange=()=>{$("endDate").min=$("startDate").value;};
loadSpaces();
