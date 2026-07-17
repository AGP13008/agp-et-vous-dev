import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, collection, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
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
let pendingPrivate = null;
let editingType = null;
let editingId = null;

const labels = {
  classifieds: "Entre voisins",
  aid: "Entraide",
  artisans: "Artisans recommandés",
  privateInfo: "Informations Grand Pavois"
};

function route(name) {
  views.forEach(view => view.classList.toggle("active", view.dataset.view === name));
  nav.forEach(button => button.classList.toggle("active", button.dataset.route === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openLogin() { modal.classList.add("open"); }
function closeLogin() { modal.classList.remove("open"); }

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function formatDate(value, options = { day: "numeric", month: "long", year: "numeric" }) {
  if (!value) return "";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", options).format(date);
}

function toDateInput(value) {
  if (!value) return "";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function showAdminMessage(text, kind = "success") {
  const message = document.getElementById("adminMessage");
  message.textContent = text;
  message.className = `admin-message ${kind}`;
  message.hidden = false;
  window.setTimeout(() => { message.hidden = true; }, 4500);
}

document.querySelectorAll("[data-route]").forEach(button => {
  button.onclick = () => route(button.dataset.route);
});
document.querySelectorAll("[data-close]").forEach(button => { button.onclick = closeLogin; });

document.querySelectorAll(".protected").forEach(button => {
  button.onclick = () => {
    pendingPrivate = button.dataset.private || null;
    if (!currentUser) return openLogin();
    route("member");
    if (pendingPrivate) loadPrivate(pendingPrivate);
  };
});

authButton.onclick = () => currentUser ? route(currentRole === "admin" ? "admin" : "member") : openLogin();

document.getElementById("loginForm").onsubmit = async event => {
  event.preventDefault();
  loginError.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
    closeLogin();
  } catch {
    loginError.textContent = "Adresse e-mail ou mot de passe incorrect.";
  }
};

document.getElementById("resetPassword").onclick = async () => {
  const mail = loginEmail.value.trim();
  if (!mail) {
    loginError.textContent = "Saisis d'abord ton adresse e-mail.";
    return;
  }
  try {
    await sendPasswordResetEmail(auth, mail);
    loginError.textContent = "E-mail de réinitialisation envoyé.";
  } catch {
    loginError.textContent = "Impossible d'envoyer l'e-mail.";
  }
};

async function logout() {
  await signOut(auth);
  route("home");
}

document.getElementById("logoutMember").onclick = logout;
document.getElementById("logoutAdmin").onclick = logout;
document.querySelectorAll("[data-load]").forEach(button => {
  button.onclick = () => loadPrivate(button.dataset.load);
});

document.getElementById("openMemberSpace").onclick = () => route("member");
document.getElementById("openAdminSpace").onclick = () => route("admin");

document.getElementById("newNews").onclick = () => openEditor("news");
document.getElementById("newActivity").onclick = () => openEditor("activity");
document.getElementById("cancelEditor").onclick = closeEditor;
document.getElementById("closeEditorTop").onclick = closeEditor;
document.getElementById("contentEditor").onsubmit = saveContent;

document.getElementById("adminContentLists").onclick = async event => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) {
    const item = await getAdminItem(editButton.dataset.type, editButton.dataset.edit);
    if (item) openEditor(editButton.dataset.type, item.id, item.data);
  }
  if (deleteButton) {
    await removeContent(deleteButton.dataset.type, deleteButton.dataset.delete);
  }
};

onAuthStateChanged(auth, async user => {
  currentUser = user;
  currentRole = null;
  if (!user) {
    authButton.textContent = "Se connecter";
    document.getElementById("statusText").textContent = "Association du Grand Pavois";
    return;
  }

  authButton.textContent = "Mon espace";
  document.getElementById("statusText").textContent = user.email;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const profile = snap.exists() ? snap.data() : {};
    currentRole = profile.role || "member";
    document.getElementById("memberTitle").textContent = `Bienvenue${profile.firstName ? ` ${profile.firstName}` : ""}`;
  } catch {
    currentRole = "member";
  }

  route(currentRole === "admin" ? "admin" : "member");
  if (currentRole === "admin") await loadAdminContent();
  if (pendingPrivate) loadPrivate(pendingPrivate);
});

async function loadPrivate(name) {
  const out = document.getElementById("privateResults");
  out.innerHTML = "<div class='notice'>Chargement…</div>";
  try {
    const snap = await getDocs(collection(db, name));
    if (snap.empty) {
      out.innerHTML = `<div class='notice'>Aucun contenu publié dans « ${labels[name]} » pour le moment.</div>`;
      return;
    }
    out.innerHTML = `<h2>${labels[name]}</h2>` + snap.docs.map(documentSnap => {
      const item = documentSnap.data();
      return `<article class="result"><h3>${escapeHtml(item.title || item.name || "Publication")}</h3><p>${escapeHtml(item.description || item.text || item.phone || "")}</p></article>`;
    }).join("");
  } catch {
    out.innerHTML = "<div class='notice'>Accès refusé ou erreur de chargement. Vérifie les règles Firestore.</div>";
  }
}

async function loadPublicContent() {
  await Promise.all([loadPublicNews(), loadPublicActivities()]);
}

async function loadPublicNews() {
  const container = document.getElementById("publicNewsList");
  try {
    const snap = await getDocs(query(collection(db, "publicNews"), orderBy("createdAt", "desc")));
    const items = snap.docs.map(documentSnap => ({ id: documentSnap.id, ...documentSnap.data() })).filter(item => item.published !== false);
    if (!items.length) {
      container.innerHTML = `<div class="empty-public">Les prochaines informations de l'AGP seront publiées ici.</div>`;
      return;
    }
    container.innerHTML = items.slice(0, 4).map(item => `
      <article class="card news-card">
        <div class="emoji">${escapeHtml(item.icon || "📢")}</div>
        <div>
          <span class="pill">${escapeHtml(item.category || "Vie de l'association")}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description)}</p>
          ${item.createdAt ? `<small>Publié le ${formatDate(item.createdAt)}</small>` : ""}
        </div>
      </article>`).join("");
  } catch {
    container.innerHTML = `<div class="empty-public">Impossible de charger les actualités pour le moment.</div>`;
  }
}

async function loadPublicActivities() {
  const container = document.getElementById("publicActivitiesList");
  try {
    const snap = await getDocs(query(collection(db, "publicActivities"), orderBy("eventDate", "asc")));
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const items = snap.docs
      .map(documentSnap => ({ id: documentSnap.id, ...documentSnap.data() }))
      .filter(item => item.published !== false)
      .sort((a, b) => {
        const aDate = a.eventDate?.toDate?.() || new Date(a.eventDate || 0);
        const bDate = b.eventDate?.toDate?.() || new Date(b.eventDate || 0);
        return aDate - bDate;
      });

    if (!items.length) {
      container.innerHTML = `<div class="empty-public">Les prochaines activités seront annoncées ici.</div>`;
      return;
    }

    container.innerHTML = items.map(item => {
      const eventDate = item.eventDate?.toDate?.() || new Date(item.eventDate);
      const day = Number.isNaN(eventDate.getTime()) ? "À VENIR" : formatDate(eventDate, { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
      return `<article class="card row activity-card">
        <div class="date"><b>${escapeHtml(day)}</b><span>${escapeHtml(item.time || "")}</span></div>
        <div>
          <span class="pill">${escapeHtml(item.category || "Activité AGP")}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description || "")}</p>
          ${item.location ? `<p class="location">📍 ${escapeHtml(item.location)}</p>` : ""}
        </div>
      </article>`;
    }).join("");
  } catch {
    container.innerHTML = `<div class="empty-public">Impossible de charger les activités pour le moment.</div>`;
  }
}

function openEditor(type, id = null, data = {}) {
  editingType = type;
  editingId = id;
  const isActivity = type === "activity";
  document.getElementById("editorTitle").textContent = id
    ? `Modifier ${isActivity ? "l'activité" : "l'actualité"}`
    : `Nouvelle ${isActivity ? "activité" : "actualité"}`;
  document.getElementById("editorType").value = type;
  document.getElementById("contentTitle").value = data.title || "";
  document.getElementById("contentCategory").value = data.category || (isActivity ? "Activité AGP" : "Vie de l'association");
  document.getElementById("contentDescription").value = data.description || "";
  document.getElementById("contentPublished").checked = data.published !== false;
  document.getElementById("activityFields").hidden = !isActivity;
  document.getElementById("contentDate").required = isActivity;
  document.getElementById("contentDate").value = isActivity ? toDateInput(data.eventDate) : "";
  document.getElementById("contentTime").value = data.time || "";
  document.getElementById("contentLocation").value = data.location || "";
  document.getElementById("contentEditorPanel").hidden = false;
  document.getElementById("contentTitle").focus();
}

function closeEditor() {
  editingType = null;
  editingId = null;
  document.getElementById("contentEditor").reset();
  document.getElementById("contentEditorPanel").hidden = true;
}

async function saveContent(event) {
  event.preventDefault();
  if (currentRole !== "admin") return;

  const type = document.getElementById("editorType").value;
  const isActivity = type === "activity";
  const collectionName = isActivity ? "publicActivities" : "publicNews";
  const saveButton = document.getElementById("saveContent");
  saveButton.disabled = true;
  saveButton.textContent = "Enregistrement…";

  const payload = {
    title: document.getElementById("contentTitle").value.trim(),
    category: document.getElementById("contentCategory").value.trim(),
    description: document.getElementById("contentDescription").value.trim(),
    published: document.getElementById("contentPublished").checked,
    updatedAt: serverTimestamp()
  };

  if (isActivity) {
    const dateValue = document.getElementById("contentDate").value;
    payload.eventDate = Timestamp.fromDate(new Date(`${dateValue}T12:00:00`));
    payload.time = document.getElementById("contentTime").value.trim();
    payload.location = document.getElementById("contentLocation").value.trim();
  }

  try {
    if (editingId) {
      await updateDoc(doc(db, collectionName, editingId), payload);
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, collectionName), payload);
    }
    closeEditor();
    showAdminMessage(`${isActivity ? "L'activité" : "L'actualité"} a bien été enregistrée.`);
    await Promise.all([loadAdminContent(), loadPublicContent()]);
  } catch (error) {
    console.error(error);
    showAdminMessage("L'enregistrement a échoué. Vérifiez que les nouvelles règles Firestore ont bien été publiées.", "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Enregistrer";
  }
}

async function getAdminItem(type, id) {
  const collectionName = type === "activity" ? "publicActivities" : "publicNews";
  try {
    const snap = await getDoc(doc(db, collectionName, id));
    return snap.exists() ? { id: snap.id, data: snap.data() } : null;
  } catch {
    return null;
  }
}

async function removeContent(type, id) {
  if (currentRole !== "admin") return;
  const label = type === "activity" ? "cette activité" : "cette actualité";
  if (!window.confirm(`Supprimer définitivement ${label} ?`)) return;
  const collectionName = type === "activity" ? "publicActivities" : "publicNews";
  try {
    await deleteDoc(doc(db, collectionName, id));
    showAdminMessage(`${type === "activity" ? "L'activité" : "L'actualité"} a été supprimée.`);
    await Promise.all([loadAdminContent(), loadPublicContent()]);
  } catch {
    showAdminMessage("La suppression a échoué.", "error");
  }
}

async function loadAdminContent() {
  if (currentRole !== "admin") return;
  const newsContainer = document.getElementById("adminNewsList");
  const activitiesContainer = document.getElementById("adminActivitiesList");
  newsContainer.innerHTML = "<div class='admin-empty'>Chargement…</div>";
  activitiesContainer.innerHTML = "<div class='admin-empty'>Chargement…</div>";

  try {
    const [newsSnap, activitiesSnap] = await Promise.all([
      getDocs(query(collection(db, "publicNews"), orderBy("createdAt", "desc"))),
      getDocs(query(collection(db, "publicActivities"), orderBy("eventDate", "asc")))
    ]);

    newsContainer.innerHTML = newsSnap.empty
      ? "<div class='admin-empty'>Aucune actualité créée.</div>"
      : newsSnap.docs.map(documentSnap => adminCard("news", documentSnap.id, documentSnap.data())).join("");

    activitiesContainer.innerHTML = activitiesSnap.empty
      ? "<div class='admin-empty'>Aucune activité créée.</div>"
      : activitiesSnap.docs.map(documentSnap => adminCard("activity", documentSnap.id, documentSnap.data())).join("");
  } catch (error) {
    console.error(error);
    newsContainer.innerHTML = "<div class='admin-empty error-text'>Impossible de charger les actualités.</div>";
    activitiesContainer.innerHTML = "<div class='admin-empty error-text'>Impossible de charger les activités.</div>";
  }
}

function adminCard(type, id, item) {
  const isActivity = type === "activity";
  const detail = isActivity
    ? [formatDate(item.eventDate), item.time, item.location].filter(Boolean).join(" · ")
    : (item.category || "Actualité");
  return `<article class="admin-item">
    <div>
      <div class="admin-item-top"><span class="status ${item.published === false ? "draft" : "published"}">${item.published === false ? "Masqué" : "Publié"}</span></div>
      <h3>${escapeHtml(item.title || "Sans titre")}</h3>
      <p>${escapeHtml(detail)}</p>
    </div>
    <div class="admin-actions">
      <button type="button" data-edit="${id}" data-type="${type}">Modifier</button>
      <button type="button" class="danger" data-delete="${id}" data-type="${type}">Supprimer</button>
    </div>
  </article>`;
}

loadPublicContent();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => console.warn("Service worker non enregistré", error));
  });
}
