let canDraw = true; // ⏲️ 初始可以畫
const firebaseConfig = {
  apiKey: "AIzaSyB959RW8D1XI-yQDiJWgWXUvrbdHyMZZNk",
  authDomain: "game-two-c0d5b.firebaseapp.com",
  databaseURL: "https://game-two-c0d5b-default-rtdb.firebaseio.com",
  projectId: "game-two-c0d5b",
  storageBucket: "game-two-c0d5b.appspot.com",
  messagingSenderId: "874203719531",
  appId: "1:874203719531:web:05bee1c0d8b9a3df904e2e"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
// ✅ 說話
function speak(text) {
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  synth.speak(utterance);
}
// ✅ 任務列表
const taskList = [
  "一起畫兩樣水果",
  "一起畫一棵會開花的樹",
  "一起畫健康的早餐",
  "一起畫天空裡的東西",
];

// ✅ 畫布設定
const canvas = document.getElementById("output");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
ctx.globalAlpha = 0.4;
ctx.globalCompositeOperation = "multiply";

// ✅ 畫筆設定
let penSize = 5;
let playerColor = "#FF0000";
let drawing = false, lastX = 0, lastY = 0;

// ✅ 按鈕控制
const dot = document.getElementById("cursorDot");
const finishBtn = document.getElementById("finishBtn");
const clearBtn = document.getElementById("clearBtn");

// ✅ 顏色切換
document.querySelectorAll(".colorBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    playerColor = btn.dataset.color;

    // 顏色代碼對照中文名稱
    const colorNames = {
      "#FF0000": "紅色",
      "#FF8000": "橘色",
      "#FFFF00": "黃色",
      "#00FF00": "綠色",
      "#0000FF": "藍色",
      "#8000FF": "紫色",
      "#FF99CC": "粉紅色",
      "#000000": "黑色",
      "#FFFFFF": "白色"
    };

   const name = colorNames[playerColor] || "這個顏色";
   speak(`你選擇的是 ${name}`);
  });
});


// ✅ 清除畫布
clearBtn.addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  firebase.database().ref("drawings").remove();
  speak("畫布清乾淨了！");
});

// ✅ 完成任務
finishBtn.addEventListener("click", () => {
  speak("任務完成！太棒了！");
  document.getElementById("prompt").textContent = "🎉 任務完成！太棒了 🎉";
});
// ✅ 玩家角色分配
let playerRole = "null";
let playerName = "";

async function assignPlayerRole() {
  const snapshot = await firebase.database().ref("players").get();
  const players = snapshot.val() || {};
  const names = Object.keys(players);

  if (!names.includes("player1")) {
    playerRole = "player1";
    await firebase.database().ref("players/player1").set({ online: true });
  } else if (!names.includes("player2")) {
    playerRole = "player2";
    await firebase.database().ref("players/player2").set({ online: true });
  } else {
    playerRole = "observer";
  }

  playerName = playerRole;
  console.log("你是：" + playerName);
  startHeartbeat();
}

function startHeartbeat() {
  setInterval(() => {
    if (playerRole === "player1" || playerRole === "player2") {
      firebase.database().ref(`players/${playerRole}/lastSeen`).set(Date.now());
    }
  }, 5000);
}

setInterval(async () => {
  const snapshot = await firebase.database().ref("players").get();
  const players = snapshot.val() || {};
  const now = Date.now();
  for (const role in players) {
    const lastSeen = players[role]?.lastSeen || 0;
    if (now - lastSeen > 15000) {
      await firebase.database().ref(`players/${role}`).remove();
      console.log(`🧹 已移除離線玩家 ${role}`);
    }
  }
}, 7000);

assignPlayerRole();

function startCountdown(duration) {
  const timerDisplay = document.getElementById("timer");
  let timeLeft = duration;

  const countdown = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `剩下時間：${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (timeLeft <= 0) {
      clearInterval(countdown);
      timerDisplay.textContent = "⏰ 時間到！";
     canDraw = false; // ⛔ 停止畫圖
      speak("時間到了！畫畫結束！");
      // 你可以在這裡加動畫、儲存畫布等
    }

    timeLeft--;
  }, 1000);
}

// 呼叫倒數計時（4 分鐘 = 240 秒）
startCountdown(240);

// ✅ MediaPipe 手勢畫圖邏輯
const videoElement = document.getElementById("webcam");
const hands = new Hands({
  locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5
});

hands.onResults(results => {
  if (!canDraw) return; // ⛔ 時間到就不畫

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    dot.style.display = "none";
    drawing = false;
    return;
  }

  const indexTip = results.multiHandLandmarks[0][8];
  const indexBase = results.multiHandLandmarks[0][6];
  const isFist = indexTip.y > indexBase.y;

  const x = (1 - indexTip.x) * canvas.width;
  const y = indexTip.y * canvas.height;

  dot.style.left = `${x - 10}px`;
  dot.style.top = `${y - 10}px`;
  dot.style.display = "block";

  if (isFist) {
    if (!drawing) {
      drawing = true;
      lastX = x;
      lastY = y;
    }

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = playerColor;
    ctx.lineWidth = penSize;
    ctx.stroke();

    firebase.database().ref("drawings").push({
      x1: lastX,
      y1: lastY,
      x2: x,
      y2: y,
      color: playerColor,
      size: penSize
    });

    lastX = x;
    lastY = y;
  } else {
    drawing = false;
  }
});

new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480
}).start();

// ✅ 開始畫畫按鈕事件
document.getElementById("startBtn").addEventListener("click", () => {
  document.getElementById("howToPlay").style.display = "none";
  document.getElementById("colorSelector").style.display = "block";
  document.getElementById("finishBtn").style.display = "block";
  document.getElementById("clearBtn").style.display = "block";
  document.getElementById("resetPlayersBtn").style.display = "block";

  // ✅ 初始化畫畫任務
  startDrawing();
});
function startDrawing() {
  console.log("開始畫畫！");
  // 任務文字載入
  const task = taskList[Math.floor(Math.random() * taskList.length)];
  document.getElementById("prompt").textContent = "🎨 任務： " + task;
  speak("今天的任務是 " + task);

  // 顯示攝影機
  videoElement.style.display = "block";

  // 若有額外要開啟的功能（如語音、MediaPipe 訊息等）也可放這裡
}
