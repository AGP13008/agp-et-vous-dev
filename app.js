import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const views = [...document.querySelectorAll("[data-view]")];
const nav = [...document.querySelectorAll(".bottom [data-route]")];
const modal = document.getElementById("loginModal");
const authButton = document.getElementById("authButton");
const loginEmail = document.getElementById("email");
const loginPassword = document.getElementById("password");
const loginError = document.getElementById("loginError");
let currentUser = null;
let currentRole = null;
let editingId = null;

const labels = { activities: "Activités AGP", classifieds: "Entre voisins", aid: "Entraide", artisans: "Artisans recommandés" };

function route(name) {
  views.forEach(view => view.classList.toggle("active", view.dataset.view === name));
  nav.forEach(button => button.classList.toggle("active", button.dataset.route === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function openLogin() { modal.classList.add("open"); }
function closeLogin() { modal.classList.remove("open"); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c]); }
function asDate(value) { return value?.toDate ? value.toDate() : new Date(value); }
function formatDate(value, options = { weekday: "long", day: "numeric", month: "long" }) {
  if (!value) return ""; const date = asDate(value); if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", options).format(date);
}
function toDateInput(value) {
  if (!value) return ""; const date = asDate(value); if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10);
}
function showAdminMessage(text, kind = "success") {
  const box = document.getElementById("adminMessage"); box.textContent = text; box.className = `admin-message ${kind}`; box.hidden = false;
  window.setTimeout(() => { box.hidden = true; }, 4500);
}

document.querySelectorAll("[data-route]").forEach(button => { button.onclick = () => route(button.dataset.route); });
document.querySelectorAll("[data-close]").forEach(button => { button.onclick = closeLogin; });
document.getElementById("homeLogin").onclick = openLogin;
authButton.onclick = () => currentUser ? route(currentRole === "admin" ? "admin" : "member") : openLogin();

document.querySelectorAll("[data-member-section]").forEach(button => {
  button.onclick = () => {
    const section = button.dataset.memberSection;
    if (!currentUser) { openLogin(); return; }
    route("member");
    loadMemberSection(section);
  };
});

document.getElementById("loginForm").onsubmit = async event => {
  event.preventDefault(); loginError.textContent = "";
  try { await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value); closeLogin(); }
  catch { loginError.textContent = "Adresse e-mail ou mot de passe incorrect."; }
};
document.getElementById("resetPassword").onclick = async () => {
  const mail = loginEmail.value.trim();
  if (!mail) { loginError.textContent = "Saisissez d'abord votre adresse e-mail."; return; }
  try { await sendPasswordResetEmail(auth, mail); loginError.textContent = "E-mail de réinitialisation envoyé."; }
  catch { loginError.textContent = "Impossible d'envoyer l'e-mail."; }
};
async function logout() { await signOut(auth); route("home"); }
document.getElementById("logoutMember").onclick = logout;
document.getElementById("logoutAdmin").onclick = logout;
document.getElementById("openMemberSpace").onclick = () => { route("member"); loadMemberDashboard(); };
document.getElementById("newActivity").onclick = () => openEditor();
document.getElementById("manageActivities").onclick = () => document.getElementById("adminActivitiesList").scrollIntoView({ behavior: "smooth" });
document.querySelectorAll("[data-future]").forEach(button => { button.onclick = () => showAdminMessage(`${button.dataset.future} sera développé dans une prochaine étape.`, "info"); });
document.getElementById("cancelEditor").onclick = closeEditor;
document.getElementById("closeEditorTop").onclick = closeEditor;
document.getElementById("contentEditor").onsubmit = saveActivity;
document.getElementById("adminActivitiesList").onclick = async event => {
  const edit = event.target.closest("[data-edit]"); const remove = event.target.closest("[data-delete]");
  if (edit) { const snap = await getDoc(doc(db, "publicActivities", edit.dataset.edit)); if (snap.exists()) openEditor(snap.id, snap.data()); }
  if (remove) await removeActivity(remove.dataset.delete);
};

onAuthStateChanged(auth, async user => {
  currentUser = user; currentRole = null;
  if (!user) { authButton.textContent = "Se connecter"; document.getElementById("statusText").textContent = "Association du Grand Pavois"; return; }
  authButton.textContent = "Mon espace"; document.getElementById("statusText").textContent = user.email;
  try {
    const snap = await getDoc(doc(db, "users", user.uid)); const profile = snap.exists() ? snap.data() : {};
    currentRole = profile.role || "member";
    document.getElementById("memberTitle").textContent = `Bienvenue${profile.firstName ? ` ${profile.firstName}` : ""}`;
  } catch { currentRole = "member"; }
  if (currentRole === "admin") { route("admin"); await loadAdminActivities(); }
  else { route("member"); await loadMemberDashboard(); }
});

async function getActivities(includeHidden = false) {
  const snap = await getDocs(query(collection(db, "publicActivities"), orderBy("eventDate", "asc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(item => includeHidden || item.published !== false);
}
function isUpcoming(item) {
  const date = asDate(item.eventDate); if (Number.isNaN(date.getTime())) return true;
  const end = new Date(date); end.setHours(23, 59, 59, 999); return end >= new Date();
}
function activityCard(item, compact = false) {
  const dateText = formatDate(item.eventDate);
  return `<article class="member-activity-card${compact ? " compact" : ""}">
    <div class="activity-date"><span>${escapeHtml(formatDate(item.eventDate, { month: "short" }).toUpperCase())}</span><b>${escapeHtml(formatDate(item.eventDate, { day: "2-digit" }))}</b></div>
    <div class="activity-body"><span class="pill">${escapeHtml(item.category || "Activité AGP")}</span><h3>${escapeHtml(item.title || "Activité")}</h3>
    <p class="activity-meta">${escapeHtml([dateText, item.time, item.location].filter(Boolean).join(" · "))}</p>${compact ? "" : `<p>${escapeHtml(item.description || "")}</p>`}</div>
  </article>`;
}
async function loadMemberDashboard() {
  const container = document.getElementById("memberUpcomingActivities"); container.innerHTML = "<div class='notice'>Chargement…</div>";
  document.getElementById("privateResults").innerHTML = "";
  try {
    const activities = (await getActivities()).filter(isUpcoming).slice(0, 3);
    container.innerHTML = activities.length ? activities.map(item => activityCard(item, true)).join("") : "<div class='notice'>Aucune activité programmée pour le moment.</div>";
  } catch { container.innerHTML = "<div class='notice'>Impossible de charger les activités.</div>"; }
}
async function loadMemberSection(name) {
  const out = document.getElementById("privateResults"); out.innerHTML = "<div class='notice'>Chargement…</div>";
  if (name === "activities") {
    try {
      const items = (await getActivities()).filter(isUpcoming);
      out.innerHTML = `<div class="section-title"><div><span>PROGRAMME</span><h2>${labels.activities}</h2></div></div>` + (items.length ? items.map(item => activityCard(item)).join("") : "<div class='notice'>Aucune activité programmée.</div>");
    } catch { out.innerHTML = "<div class='notice'>Impossible de charger les activités.</div>"; }
    return;
  }
  try {
    const snap = await getDocs(collection(db, name));
    out.innerHTML = `<div class="section-title"><div><span>ESPACE PRIVÉ</span><h2>${labels[name]}</h2></div></div>` + (snap.empty ? `<div class='notice'>Aucun contenu publié pour le moment.</div>` : snap.docs.map(d => { const x = d.data(); return `<article class="result"><h3>${escapeHtml(x.title || x.name || "Publication")}</h3><p>${escapeHtml(x.description || x.text || x.phone || "")}</p></article>`; }).join(""));
  } catch { out.innerHTML = "<div class='notice'>Impossible de charger cette rubrique.</div>"; }
}

function openEditor(id = null, data = {}) {
  editingId = id; document.getElementById("editorTitle").textContent = id ? "Modifier l'activité" : "Nouvelle activité";
  document.getElementById("contentTitle").value = data.title || "";
  document.getElementById("contentCategory").value = data.category || "Activité AGP";
  document.getElementById("contentDescription").value = data.description || "";
  document.getElementById("contentDate").value = toDateInput(data.eventDate);
  document.getElementById("contentTime").value = data.time || "";
  document.getElementById("contentLocation").value = data.location || "";
  document.getElementById("contentPublished").checked = data.published !== false;
  document.getElementById("contentEditorPanel").hidden = false; document.getElementById("contentTitle").focus();
}
function closeEditor() { editingId = null; document.getElementById("contentEditor").reset(); document.getElementById("contentCategory").value = "Activité AGP"; document.getElementById("contentPublished").checked = true; document.getElementById("contentEditorPanel").hidden = true; }
async function saveActivity(event) {
  event.preventDefault(); if (currentRole !== "admin") return;
  const button = document.getElementById("saveContent"); button.disabled = true; button.textContent = "Enregistrement…";
  const dateValue = document.getElementById("contentDate").value;
  const payload = { title: document.getElementById("contentTitle").value.trim(), category: document.getElementById("contentCategory").value.trim(), description: document.getElementById("contentDescription").value.trim(), eventDate: Timestamp.fromDate(new Date(`${dateValue}T12:00:00`)), time: document.getElementById("contentTime").value.trim(), location: document.getElementById("contentLocation").value.trim(), published: document.getElementById("contentPublished").checked, updatedAt: serverTimestamp() };
  try {
    if (editingId) await updateDoc(doc(db, "publicActivities", editingId), payload); else { payload.createdAt = serverTimestamp(); await addDoc(collection(db, "publicActivities"), payload); }
    closeEditor(); showAdminMessage("L'activité a bien été enregistrée."); await loadAdminActivities();
  } catch (error) { console.error(error); showAdminMessage("L'enregistrement a échoué. Vérifiez les règles Firestore.", "error"); }
  finally { button.disabled = false; button.textContent = "Enregistrer"; }
}
async function removeActivity(id) {
  if (!window.confirm("Supprimer définitivement cette activité ?")) return;
  try { await deleteDoc(doc(db, "publicActivities", id)); showAdminMessage("L'activité a été supprimée."); await loadAdminActivities(); }
  catch { showAdminMessage("La suppression a échoué.", "error"); }
}
async function loadAdminActivities() {
  const out = document.getElementById("adminActivitiesList"); out.innerHTML = "<div class='admin-empty'>Chargement…</div>";
  try {
    const items = await getActivities(true);
    out.innerHTML = items.length ? items.map(item => `<article class="admin-item"><div><div class="admin-item-top"><span class="status ${item.published === false ? "draft" : "published"}">${item.published === false ? "Masquée" : "Visible"}</span></div><h3>${escapeHtml(item.title || "Sans titre")}</h3><p>${escapeHtml([formatDate(item.eventDate), item.time, item.location].filter(Boolean).join(" · "))}</p></div><div class="admin-actions"><button type="button" data-edit="${item.id}">Modifier</button><button type="button" class="danger" data-delete="${item.id}">Supprimer</button></div></article>`).join("") : "<div class='admin-empty'>Aucune activité créée.</div>";
  } catch { out.innerHTML = "<div class='admin-empty error-text'>Impossible de charger les activités.</div>"; }
}

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(error => console.warn("Service worker non enregistré", error)));
