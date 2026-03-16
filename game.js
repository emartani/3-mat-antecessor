// ===== Helpers =====
const $ = (s)=>document.querySelector(s);
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

  // fluxo mobile/teclado: valor da peça atualmente selecionada (ou null)
  selectedVal: null,
};

function applyDifficulty(v){
  if(v==="easy"){ state.min=0; state.max=20; }
  else if(v==="medium"){ state.min=0; state.max=100; }
  else { state.min=-50; state.max=200; }
}

// ===== Round =====
function newRound(){
  state.anchor = rnd(state.min, state.max);
  state.answerAnte = state.anchor - 1;
  state.answerSucess = state.anchor + 1;

  els.anchorLabel.textContent = state.anchor;
  resetSlots();
  buildPieces();
  setFeedback("");

  // Foco no primeiro slot para acessibilidade/fluxo
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

// Cria as peças: mantém drag&drop, mas remove “click-to-place automático”
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
    const el = document.createElement("button");
    el.className = "piece";
    el.textContent = val;
    el.type = "button";
    el.setAttribute("draggable","true");
    el.setAttribute("aria-label", `Número ${val}`);

    // Desktop: drag & drop
    el.addEventListener("dragstart", onDragStart);
    // Mobile/teclado: selecionar/deselecionar peça (NÃO coloca no slot)
    el.addEventListener("click", ()=> toggleSelect(val, el));
    el.addEventListener("touchstart", ()=> toggleSelect(val, el), {passive:true});

    els.pieces.appendChild(el);
  });
}

// ===== Seleção (mobile/teclado): peça selecionada e depois slot clicado =====
function toggleSelect(val, el){
  // Se a peça já foi usada, ignore
  if(el.disabled || el.getAttribute("draggable")!=="true"){ return; }

  // Toggle seleção
  if(state.selectedVal === val){
    state.selectedVal = null;
    el.classList.remove("selected");
  } else {
    // Limpa seleção anterior
    $$(".piece.selected").forEach(p=>p.classList.remove("selected"));
    state.selectedVal = val;
    el.classList.add("selected");
  }
}

// Slots: aceitam drop e também clique/toque para colocar A PEÇA SELECIONADA
[els.slotAnte, els.slotSucess].forEach(slot=>{
  // Drag & drop (desktop)
  slot.addEventListener("dragover", (e)=>{ e.preventDefault(); slot.classList.add("ready"); });
  slot.addEventListener("dragleave", ()=> slot.classList.remove("ready"));
  slot.addEventListener("drop", (e)=>{
    e.preventDefault();
    slot.classList.remove("ready");
    const data = Number(e.dataTransfer.getData("text/plain"));
    tryPlaceValue(slot, data);
  });

  // Clique/toque (mobile/teclado): coloca a peça SE houver uma selecionada
  slot.addEventListener("click", ()=>{
    if(state.selectedVal === null) return;
    tryPlaceValue(slot, state.selectedVal);
  });
  slot.addEventListener("touchstart", ()=>{
    if(state.selectedVal === null) return;
    tryPlaceValue(slot, state.selectedVal);
  }, {passive:true});

  // Teclado: Enter/Space coloca a peça selecionada
  slot.addEventListener("keydown", (e)=>{
    if(e.key==="Enter" || e.key===" "){
      e.preventDefault();
      if(state.selectedVal !== null){
        tryPlaceValue(slot, state.selectedVal);
      }
    }
  });
});

// ===== Drag & Drop (desktop) =====
let dragValue = null;
function onDragStart(e){
  dragValue = Number(e.target.textContent);
  e.dataTransfer.setData("text/plain", String(dragValue));
}
document.addEventListener("dragend", ()=> dragValue=null);

function tryPlaceValue(slot, val){
  // Slot já preenchido? não substitui
  if(slot.dataset.value){
    setFeedback("Este espaço já foi preenchido. Use o outro ou avance.", "hint");
    return;
  }

  const kind = slot.dataset.kind; // "ante" | "sucess"
  const correct = (kind === "ante" ? state.answerAnte : state.answerSucess);
  const piece = findDraggablePiece(val);
  if(!piece){ 
    // Pode ocorrer se a peça já foi usada ou se tocou no vazio
    setFeedback("Selecione uma peça válida primeiro.", "hint");
    return; 
  }

  // Encaixa no slot
  slot.classList.add("filled");
  slot.dataset.value = String(val);
  slot.querySelector(".slot-drop").textContent = val;

  // Marca peça como usada
  piece.classList.add(val===correct ? "correct":"wrong");
  piece.setAttribute("draggable","false");
  piece.disabled = true;
  piece.style.cursor = "not-allowed";
  piece.classList.remove("selected");

  // Limpa seleção se esta peça estava selecionada
  if(state.selectedVal === val){ state.selectedVal = null; }

  // Atualiza estado dos slots
  if(kind==="ante"){ state.filledAnte = val; } else { state.filledSucess = val; }

  // Pontuação/feedback
  const ok = (val===correct);
  addScore(ok);
  if(ok){ setFeedback("Boa! ✔️", "good"); }
  else{
    setFeedback("Ops! ❌", "bad");
    if(state.showTips) setFeedback(explain(kind), "hint", true);
  }

  // Validar rodada quando ambos preenchidos
  if(state.filledAnte!==null && state.filledSucess!==null){
    finalizeRound();
  }
}

function findDraggablePiece(val){
  return $$(".piece").find(p => Number(p.textContent)===val && p.getAttribute("draggable")==="true" && !p.disabled);
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