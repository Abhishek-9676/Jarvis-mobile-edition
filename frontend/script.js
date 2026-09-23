(() => {
  "use strict";

  const MODEL = "gemini-3.5-flash-lite";
  const API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
  const KEY_NAME = "jarvis_key";
  const MEMORY_NAME = "jarvis_memory";
  const SYSTEM_INSTRUCTION = [
    "You are J.A.R.V.I.S, a helpful personal AI assistant.",
    "Follow the user's requested language exactly.",
    "If the user asks for Telugu, reply in Telugu Unicode.",
    "If the user asks for English, reply in English.",
    "If the user uses Roman Telugu or Telugu-English, reply in simple Roman Telugu/Telugu-English.",
    "Do not switch languages unless the user asks.",
    "Keep replies clear, practical and concise unless the user asks for detail.",
    "Do not read formatting symbols such as *, #, _, backticks, braces or brackets as spoken content."
  ].join(" ");

  let API_KEY = "";
  let MEMORY = loadMemory();

  const $ = id => document.getElementById(id);
  let chat, input, micBtn, clearBtn, camBtn, imgInput, sendBtn;
  let keyModal, keyInput, saveKeyBtn, cancelKeyBtn, keyError;

  function loadMemory() {
    try {
      const value = JSON.parse(localStorage.getItem(MEMORY_NAME) || "[]");
      return Array.isArray(value)
        ? value.filter(m => m && (m.role === "user" || m.role === "model") && typeof m.text === "string")
        : [];
    } catch {
      return [];
    }
  }

  function saveMemory() {
    try {
      localStorage.setItem(MEMORY_NAME, JSON.stringify(MEMORY.slice(-100)));
    } catch {}
  }

  function add(text, type) {
    if (!chat) return null;
    const div = document.createElement("div");
    div.className = "msg " + type;
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  }

  function showMemory() {
    if (!chat) return;
    chat.textContent = "";
    MEMORY.forEach(m => add((m.role === "user" ? "YOU: " : "J.A.R.V.I.S: ") + m.text, m.role === "user" ? "user" : "ai"));
  }

  function openKeyModal() {
    if (!keyModal) return;
    keyModal.hidden = false;
    keyError.textContent = "";
    keyInput.value = "";
    setTimeout(() => keyInput.focus(), 50);
  }

  function closeKeyModal() {
    if (keyModal) keyModal.hidden = true;
  }

  function ensureKey() {
    API_KEY = localStorage.getItem(KEY_NAME) || "";
    if (!API_KEY) openKeyModal();
    return Boolean(API_KEY);
  }

  function saveKey() {
    const value = keyInput.value.trim();
    if (!value) {
      keyError.textContent = "Please enter your Gemini API key.";
      return;
    }
    API_KEY = value;
    localStorage.setItem(KEY_NAME, API_KEY);
    closeKeyModal();
  }

  function cleanSpeech(text) {
    return String(text || "")
      .replace(/```[\s\S]*?```/g, " code omitted ")
      .replace(/https?:\/\/\S+/gi, " link omitted ")
      .replace(/www\.\S+/gi, " link omitted ")
      .replace(/[\*#_`~|{}\[\]<>]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    const clean = cleanSpeech(text);
    if (!clean) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.03;
    utterance.pitch = 0.85;
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => /^en-IN/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
  }

  function memoryContext(current) {
    const recent = MEMORY.slice(-20)
      .map(m => `${m.role === "user" ? "USER" : "J.A.R.V.I.S"}: ${m.text}`)
      .join("\n");
    return recent
      ? `Recent conversation memory:\n${recent}\n\nCurrent user message:\n${current}`
      : current;
  }

  function extractText(data) {
    if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
    const steps = Array.isArray(data?.steps) ? data.steps : [];
    const blocks = [];
    for (const step of steps) {
      if (step?.type !== "model_output" || !Array.isArray(step.content)) continue;
      for (const block of step.content) {
        if (block?.type === "text" && typeof block.text === "string") blocks.push(block.text);
      }
    }
    return blocks.join("\n").trim();
  }

  async function callInteractions(inputPayload, extraInstruction = "") {
    if (!ensureKey()) throw new Error("Gemini API key is required.");

    const body = {
      model: MODEL,
      store: false,
      system_instruction: SYSTEM_INSTRUCTION + (extraInstruction ? " " + extraInstruction : ""),
      input: inputPayload,
      generation_config: { temperature: 0.7, max_output_tokens: 2048 }
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },
      body: JSON.stringify(body)
    });

    let data = {};
    try { data = await response.json(); } catch {}

    if (!response.ok || data.error) {
      const message = data?.error?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }

    const text = extractText(data);
    if (!text) throw new Error("Gemini returned no text.");
    return text;
  }

  async function askGemini(prompt) {
    if (!ensureKey()) return;
    const thinking = add("J.A.R.V.I.S: Thinking...", "ai");
    try {
      const reply = await callInteractions(memoryContext(prompt));
      MEMORY.push({ role: "user", text: prompt }, { role: "model", text: reply });
      saveMemory();
      thinking.textContent = "J.A.R.V.I.S: " + reply;
      speak(reply);
    } catch (error) {
      thinking.textContent = "J.A.R.V.I.S: ERROR - " + (error.message || String(error));
    }
  }

  async function askVision(base64, mime, question) {
    if (!ensureKey()) return;
    const box = add("J.A.R.V.I.S: Analyzing image...", "ai");
    try {
      const reply = await callInteractions([
        { type: "text", text: question },
        { type: "image", mime_type: mime || "image/jpeg", data: base64 }
      ], "For image questions, describe only what can reasonably be observed. Do not invent details.");
      box.textContent = "J.A.R.V.I.S: " + reply;
      speak(reply);
    } catch (error) {
      box.textContent = "J.A.R.V.I.S: ERROR - " + (error.message || String(error));
    }
  }

  function setupMic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || !micBtn) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    micBtn.addEventListener("click", () => {
      try {
        recognition.start();
        micBtn.textContent = "LISTENING...";
      } catch {}
    });

    recognition.onresult = event => {
      const text = event.results?.[0]?.[0]?.transcript?.trim();
      if (!text) return;
      add("YOU: " + text, "user");
      askGemini(text);
    };

    recognition.onerror = event => add("SYSTEM: Microphone error - " + event.error, "ai");
    recognition.onend = () => { micBtn.textContent = "🎙️"; };
  }

  function setup() {
    chat = $("chat");
    input = $("msg");
    micBtn = $("mic-btn");
    clearBtn = $("clear-btn");
    camBtn = $("cam-btn");
    imgInput = $("img-input");
    sendBtn = $("send");
    keyModal = $("key-modal");
    keyInput = $("api-key-input");
    saveKeyBtn = $("save-key");
    cancelKeyBtn = $("cancel-key");
    keyError = $("key-error");

    showMemory();
    ensureKey();

    saveKeyBtn?.addEventListener("click", saveKey);
    cancelKeyBtn?.addEventListener("click", closeKeyModal);
    keyInput?.addEventListener("keydown", e => { if (e.key === "Enter") saveKey(); });

    sendBtn?.addEventListener("click", () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      add("YOU: " + text, "user");
      askGemini(text);
    });

    input?.addEventListener("keydown", e => {
      if (e.key === "Enter") sendBtn?.click();
    });

    clearBtn?.addEventListener("click", () => {
      if (!confirm("Clear J.A.R.V.I.S memory?")) return;
      MEMORY = [];
      saveMemory();
      showMemory();
      add("SYSTEM: Memory cleared.", "ai");
    });

    camBtn?.addEventListener("click", () => imgInput?.click());

    imgInput?.addEventListener("change", () => {
      const file = imgInput.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        add("SYSTEM: Please select an image file.", "ai");
        imgInput.value = "";
        return;
      }
      const question = input.value.trim() || "What do you see? Describe briefly.";
      input.value = "";
      add("YOU: [IMAGE] " + question, "user");
      const reader = new FileReader();
      reader.onload = () => askVision(String(reader.result).split(",")[1], file.type, question);
      reader.readAsDataURL(file);
      imgInput.value = "";
    });

    setupMic();
  }

  document.addEventListener("DOMContentLoaded", setup);
})();
