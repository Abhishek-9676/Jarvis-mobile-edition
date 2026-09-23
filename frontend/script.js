} catch (err) {

        const messages = chat.querySelectorAll(".msg.ai");

        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];

            if (lastMessage.innerText === "J.A.R.V.I.S: Thinking...") {
                lastMessage.remove();
            }
        }

        add(
            "J.A.R.V.I.S ERROR: " + (err.message || err),
            "ai"
        );
    }
}


// ===== 6. SPEECH RECOGNITION =====
const SR =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let rec = null;

if (SR) {

    rec = new SR();

    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (e) => {

        const t = e.results[0][0].transcript;

        add("YOU: " + t, "user");

        askGemini(t);
    };

    rec.onerror = (e) => {
        add(
            "J.A.R.V.I.S: Microphone error - " + e.error,
            "ai"
        );
    };

    rec.onend = () => {

        if (micBtn) {
            micBtn.innerText = "🎤";
        }
    };

    if (micBtn) {

        micBtn.onclick = () => {

            try {

                rec.start();

                micBtn.innerText = "LISTENING...";

            } catch (err) {

                // Prevent "recognition has already started" error
                console.log(err);
            }
        };
    }

} else {

    if (micBtn) {

        micBtn.onclick = () => {
            add(
                "J.A.R.V.I.S: Speech Recognition is not supported in this browser.",
                "ai"
            );
        };
    }
}


// ===== 7. TEXT-TO-SPEECH =====
let voices = [];

function loadVoices() {
    voices = speechSynthesis.getVoices();
}

loadVoices();

speechSynthesis.onvoiceschanged = loadVoices;


function speak(t) {

    if (!("speechSynthesis" in window)) {
        return;
    }

    // Cancel previous speech
    speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(t);

    u.rate = 1.05;
    u.pitch = 0.85;

    const v = voices.find(
        voice => voice.lang &&
        voice.lang.startsWith("en")
    );

    if (v) {
        u.voice = v;
    }

    speechSynthesis.speak(u);
}


// ===== 8. TEXT SEND BUTTON =====
const sendBtn = document.getElementById("send");

if (sendBtn) {

    sendBtn.onclick = () => {

        const t = input.value.trim();

        if (!t) {
            return;
        }

        add("YOU: " + t, "user");

        input.value = "";

        askGemini(t);
    };
}


// ===== 9. ENTER KEY SEND =====
if (input) {

    input.addEventListener("keydown", (e) => {

        if (e.key === "Enter" && !e.shiftKey) {

            e.preventDefault();

            if (sendBtn) {
                sendBtn.click();
            }
        }
    });
}


// ===== 10. ADD MESSAGE TO CHAT =====
function add(t, w) {

    if (!chat) {
        console.error("Chat element not found.");
        return;
    }

    const d = document.createElement("div");

    d.className = "msg " + w;

    d.innerText = t;

    chat.appendChild(d);

    chat.scrollTop = chat.scrollHeight;
}
