// ===== Helpers =====
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const rnd = (min,max)=>Math.floor(Math.random()*(max-min+1))+min;

const els = {
  settings: $("#settings"),
  game: $("#game"),
  summary: $("#summary"),
  summaryText: $("#summaryText"),

  startBtn: $("#startBtn"),
  againBtn: $("#againBtn"),
  endBtn: $("#endBtn"),
  nextBtn: $("#nextBtn"),

  difficulty: $("#difficulty"),
  tipsToggle: $("#tipsToggle"),
  timerToggle: $("#timerToggle"),
  timerWrap: $("#timerWrap"),
  time: $("#time"),

  slotAnte: $("#slot-ante"),
  slotSucess: $("#slot-sucess"),
  anchorLabel: $("#anchorLabel"),
  pieces: $("#pieces"),
  feedback: $("#feedback"),

  score: $("#score"),
  streak: $("#streak"),
};

let state = {
  min:0, max:100,
  showTips:true,
  useTimer:false, timeLeft:60, timerId:null,

  anchor:0,
  answerAnte:0, answerSucess:0,
  filledAnte:null, filledSucess:null,

  score:0, streak:0,

  // peça selecionada (fluxo mobile/teclado: tocar peça -> tocar slot)
  selectedVal: null,
};

function checkOrientation(){
  const overlay = document.getElementById("rotateOverlay");

  // iPhone/iPad Safari às vezes não atualiza orientationchange corretamente,
  // então reforçamos por width > height
  const isPortrait = window.innerHeight > window.innerWidth;

  if(isPortrait){
    overlay.style.display = "flex";
  } else {
    overlay.style.display = "none";
  }
}

// Detecta alteração de orientação
window.addEventListener("orientationchange", checkOrientation);
window.addEventListener("resize", checkOrientation);

// Checa na abertura
checkOrientation();

// ===== Dificuldade =====
function applyDifficulty(v){
  if(v==="easy"){ state.min=0; state.max=20; }
  else if(v==="medium"){ state.min=0; state.max=100; }
  else { state.min=-50; state.max=200; }
}

// ===== Engine de DRAG (Pointer Events) =====
const drag = {
  el: null, val: null,
  startX: 0, startY: 0,
  offX: 0, offY: 0,
  dragging: false,
  overSlot: null,
};

function startPointerDrag(e, el, val){
  const rect = el.getBoundingClientRect();
  drag.el = el;
  drag.val = val;
  drag.startX = e.clientX;
  drag.startY = e.clientY;
  drag.offX = e.clientX - rect.left;
  drag.offY = e.clientY - rect.top;
  drag.dragging = false;
  drag.overSlot = null;

  el.classList.add("dragging");
  el.style.width  = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  el.style.transform = `translate(${rect.left}px, ${rect.top}px)`;

  document.body.classList.add("dragging");
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp, { once: true });
}

function onPointerMove(e){
  if(!drag.el) return;

  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  if(!drag.dragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)){
    drag.dragging = true;
  }

  const x = e.clientX - drag.offX;
  const y = e.clientY - drag.offY;
  drag.el.style.transform = `translate(${x}px, ${y}px)`;

  const slot = getSlotAtPoint(e.clientX, e.clientY);
  if(slot !== drag.overSlot){
    if(drag.overSlot){ drag.overSlot.classList.remove("ready"); }
    drag.overSlot = slot;
    if(slot){ slot.classList.add("ready"); }
  }
}

function onPointerUp(e){
  if(drag.overSlot){ drag.overSlot.classList.remove("ready"); }

  if(drag.el){
    const slot = getSlotAtPoint(e.clientX, e.clientY);
    if(slot){ tryPlaceValue(slot, drag.val); }
    else { resetDraggedPiece(drag.el); }
  }

  document.body.classList.remove("dragging");
  window.removeEventListener("pointermove", onPointerMove);
  drag.el = null; drag.val = null; drag.dragging = false; drag.overSlot = null;
}

function getSlotAtPoint(x, y){
  const el = document.elementFromPoint(x, y);
  if(!el) return null;
  const slot = el.closest?.(".slot");
  if(slot && !slot.dataset.value){ return slot; }
  return null;
}

function resetDraggedPiece(el){
  el.classList.remove("dragging");
  el.style.removeProperty("width");
  el.style.removeProperty("height");
  el.style.removeProperty("transform");
}

// ===== Jogo =====
function newRound(){
  state.anchor = rnd(state.min, state.max);
  state.answerAnte = state.anchor - 1;
  state.answerSucess = state.anchor + 1;

  els.anchorLabel.textContent = state.anchor;
  resetSlots();
  buildPieces();
  setFeedback("");
  els.slotAnte.focus();
}

function resetSlots(){
  state.filledAnte = null; state.filledSucess = null;
  state.selectedVal = null;
  [els.slotAnte, els.slotSucess].forEach(slot=>{
    slot.className = "slot";
    const drop = slot.querySelector(".slot-drop");
    if (drop) drop.textContent = "Solte aqui";
    slot.dataset.value = "";
  });
}

function buildPieces(){
  els.pieces.innerHTML = "";

  const corrects = [state.answerAnte, state.answerSucess];
  const used = new Set(corrects);
  const dist = [];
  while(dist.length < 2){
    let d = state.anchor + (Math.random()<0.5?-1:1) * rnd(2,5);
    if(!used.has(d)){ used.add(d); dist.push(d); }
  }
  const all = [...corrects, ...dist].sort(()=>Math.random()-0.5);

  all.forEach(val=>{
    const el = document.createElement("div");
    el.className = "piece";
    el.textContent = val;
    el.setAttribute("role","button");
    el.setAttribute("aria-label", `Número ${val}`);

    // Drag universal
    el.addEventListener("pointerdown", (ev)=>{
      if(el.disabled) return;
      ev.preventDefault();
      startPointerDrag(ev, el, val);
    });

    // Seleção (mobile/teclado): tocar peça para selecionar; tocar slot para colocar
    el.addEventListener("click", ()=>{
      if(el.disabled) return;
      toggleSelect(val, el);
    });

    els.pieces.appendChild(el);
  });

  // Slots: clique/toque coloca a peça selecionada (fluxo alternativo)
  [els.slotAnte, els.slotSucess].forEach(slot=>{
    slot.onclick = ()=>{
      if(state.selectedVal === null) return;
      tryPlaceValue(slot, state.selectedVal);
    };
  });
}

// ===== Seleção (mobile/teclado) =====
function toggleSelect(val, el){
  if(el.disabled) return;
  if(state.selectedVal === val){
    state.selectedVal = null;
    el.classList.remove("selected");
  } else {
    $$(".piece.selected").forEach(p=>p.classList.remove("selected"));
    state.selectedVal = val;
    el.classList.add("selected");
  }
}

// ===== Lógica de encaixe =====
function tryPlaceValue(slot, val){
  if(slot.dataset.value){
    setFeedback("Este espaço já foi preenchido. Use o outro ou avance.", "hint");
    const p = findPiece(val);
    if(p) resetDraggedPiece(p);
    return;
  }

  const kind = slot.dataset.kind; // "ante" | "sucess"
  const correct = (kind === "ante" ? state.answerAnte : state.answerSucess);
  const piece = findPiece(val);
  if(!piece){ 
    setFeedback("Selecione uma peça válida.", "hint");
    return; 
  }

  slot.classList.add("filled");
  slot.dataset.value = String(val);
  slot.querySelector(".slot-drop").textContent = val;

  piece.classList.add(val===correct ? "correct":"wrong");
  piece.disabled = true;
  piece.style.cursor = "not-allowed";
  piece.classList.remove("selected");
  resetDraggedPiece(piece);

  if(kind==="ante"){ state.filledAnte = val; } else { state.filledSucess = val; }

  const ok = (val===correct);
  addScore(ok);
  if(ok){ setFeedback("Boa! ✔️", "good"); }
  else{
    setFeedback("Ops! ❌", "bad");
    if(state.showTips) setFeedback(explain(kind), "hint", true);
  }

  if(state.filledAnte!==null && state.filledSucess!==null){
    finalizeRound();
  }
}

function findPiece(val){
  return $$(".piece").find(p => Number(p.textContent)===val && !p.disabled);
}

function explain(kind){
  if(kind==="ante"){ return `Dica: <b>antecessor</b> vem <b>antes</b> de ${state.anchor}. ${state.anchor} − 1 = <b>${state.answerAnte}</b>.`; }
  return `Dica: <b>sucessor</b> vem <b>depois</b> de ${state.anchor}. ${state.anchor} + 1 = <b>${state.answerSucess}</b>.`;
}

// ===== Score / Feedback =====
function addScore(ok){
  if(ok){ state.streak++; state.score += 10 + Math.max(0, state.streak-1)*2; }
  else { state.streak = 0; state.score = Math.max(0, state.score-2); }
  els.score.textContent = state.score;
  els.streak.textContent = state.streak;
}
function setFeedback(msg, type="", append=false){
  if(!append){ els.feedback.innerHTML = ""; els.feedback.className = "feedback"; }
  if(msg){ els.feedback.innerHTML += (append ? "<br/>" : "") + msg; }
  if(type) els.feedback.classList.add(type);
}

function finalizeRound(){
  const okAnte = (state.filledAnte === state.answerAnte);
  const okSucess = (state.filledSucess === state.answerSucess);
  els.slotAnte.classList.add(okAnte ? "correct" : "wrong");
  els.slotSucess.classList.add(okSucess ? "correct" : "wrong");
  if(okAnte && okSucess){ setFeedback("Perfeito! 🏅", "good"); }
  else {
    setFeedback("Revise e tente novamente.", "bad", true);
    if(state.showTips){
      setFeedback(explain("ante"), "hint", true);
      setFeedback(explain("sucess"), "hint", true);
    }
  }
}

// ===== Timer =====
function startTimer(){
  if(!state.useTimer) return;
  els.timerWrap.classList.remove("hidden");
  state.timeLeft = 60; els.time.textContent = String(state.timeLeft);
  clearInterval(state.timerId);
  state.timerId = setInterval(()=>{
    state.timeLeft--; els.time.textContent = String(state.timeLeft);
    if(state.timeLeft<=0){ clearInterval(state.timerId); endGame(true); }
  },1000);
}
function stopTimer(){ clearInterval(state.timerId); state.timerId=null; }

// ===== Fluxo =====
function startGame(){
  applyDifficulty(els.difficulty.value);
  state.useTimer = els.timerToggle.checked;
  state.showTips = els.tipsToggle.checked;
  state.score = 0; state.streak = 0;
  els.score.textContent = "0"; els.streak.textContent = "0";

  els.settings.classList.add("hidden");
  els.summary.classList.add("hidden");
  els.game.classList.remove("hidden");

  startTimer();
  newRound();
}
function endGame(timeOver=false){
  stopTimer();
  els.game.classList.add("hidden");
  els.summary.classList.remove("hidden");
  els.summaryText.innerHTML = `Você fez <b>${state.score}</b> pontos.` + (timeOver ? " ⏰ O tempo acabou!" : "");
}
function backToSettings(){
  els.summary.classList.add("hidden");
  els.settings.classList.remove("hidden");
  els.timerWrap.classList.add("hidden");
  setFeedback("");
}

// ===== Eventos =====
els.startBtn.addEventListener("click", startGame);
els.againBtn.addEventListener("click", backToSettings);
els.endBtn.addEventListener("click", ()=> endGame(false));
els.nextBtn.addEventListener("click", newRound);
``