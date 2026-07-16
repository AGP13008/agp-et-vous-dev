import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
const views=[...document.querySelectorAll("[data-view]")], nav=[...document.querySelectorAll(".bottom [data-route]")];
const modal=document.getElementById("loginModal"), authButton=document.getElementById("authButton");
let currentUser=null,currentRole=null,pendingPrivate=null;

function route(name){views.forEach(v=>v.classList.toggle("active",v.dataset.view===name));nav.forEach(b=>b.classList.toggle("active",b.dataset.route===name));window.scrollTo({top:0,behavior:"smooth"})}
function openLogin(){modal.classList.add("open")}
function closeLogin(){modal.classList.remove("open")}
document.querySelectorAll("[data-route]").forEach(b=>b.onclick=()=>route(b.dataset.route));
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=closeLogin);

document.querySelectorAll(".protected").forEach(b=>b.onclick=()=>{
  pendingPrivate=b.dataset.private||null;
  if(!currentUser) return openLogin();
  route(currentRole==="admin"?"admin":"member");
  if(pendingPrivate) loadPrivate(pendingPrivate);
});

authButton.onclick=()=>currentUser?route(currentRole==="admin"?"admin":"member"):openLogin();

document.getElementById("loginForm").onsubmit=async e=>{
 e.preventDefault();document.getElementById("loginError").textContent="";
 try{await signInWithEmailAndPassword(auth,email.value.trim(),password.value);closeLogin()}
 catch(err){document.getElementById("loginError").textContent="Adresse e-mail ou mot de passe incorrect."}
};

document.getElementById("resetPassword").onclick=async()=>{
 const mail=document.getElementById("email").value.trim();
 if(!mail){document.getElementById("loginError").textContent="Saisis d'abord ton adresse e-mail.";return}
 try{await sendPasswordResetEmail(auth,mail);document.getElementById("loginError").textContent="E-mail de réinitialisation envoyé."}
 catch{document.getElementById("loginError").textContent="Impossible d'envoyer l'e-mail."}
};

async function logout(){await signOut(auth);route("home")}
document.getElementById("logoutMember").onclick=logout;
document.getElementById("logoutAdmin").onclick=logout;
document.querySelectorAll("[data-load]").forEach(b=>b.onclick=()=>loadPrivate(b.dataset.load));

onAuthStateChanged(auth,async user=>{
 currentUser=user;currentRole=null;
 if(!user){authButton.textContent="Se connecter";document.getElementById("statusText").textContent="Association du Grand Pavois";return}
 authButton.textContent="Mon espace";document.getElementById("statusText").textContent=user.email;
 const snap=await getDoc(doc(db,"users",user.uid));
 currentRole=snap.exists()?snap.data().role:"member";
 document.getElementById("memberTitle").textContent=`Bienvenue${snap.exists()&&snap.data().firstName?" "+snap.data().firstName:""}`;
 route(currentRole==="admin"?"admin":"member");
 if(pendingPrivate&&currentRole!=="admin") loadPrivate(pendingPrivate);
});

const labels={classifieds:"Entre voisins",aid:"Entraide",artisans:"Artisans recommandés",privateInfo:"Informations Grand Pavois"};
async function loadPrivate(name){
 const out=document.getElementById("privateResults");out.innerHTML="<div class='notice'>Chargement…</div>";
 try{
  const snap=await getDocs(collection(db,name));
  if(snap.empty){out.innerHTML=`<div class='notice'>Aucun contenu publié dans « ${labels[name]} » pour le moment.</div>`;return}
  out.innerHTML=`<h2>${labels[name]}</h2>`+snap.docs.map(d=>{const x=d.data();return `<article class="result"><h3>${escapeHtml(x.title||x.name||"Publication")}</h3><p>${escapeHtml(x.description||x.text||x.phone||"")}</p></article>`}).join("");
 }catch(e){out.innerHTML="<div class='notice'>Accès refusé ou erreur de chargement. Vérifie les règles Firestore.</div>"}
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
