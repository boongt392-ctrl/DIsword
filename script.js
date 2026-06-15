const socket = io();

let myName = "";
let currentChat = "";
let currentGroup = "";
let allMessages = [];

function login() {
  const name = document.getElementById("username").value.trim();

  if (!name) {
    alert("Masukkan nama");
    return;
  }

  socket.emit("join", name);
}

socket.on("loginSuccess", () => {
  myName = document.getElementById("username").value.trim();

  document.getElementById("loginBox").style.display = "none";

  document.getElementById("chatBox").style.display = "flex";

  document.getElementById("welcome").innerText = "Halo " + myName;
});

socket.on("loginFailed", (msg) => {
  alert(msg);
});

socket.on("messageHistory", (messages) => {
  allMessages = messages;

  document.getElementById("messages").innerHTML =
    "<p>Pilih teman atau grup</p>";
});

socket.on("users", (users) => {
  const usersDiv = document.getElementById("users");

  usersDiv.innerHTML = "";

  Object.values(users).forEach((name) => {
    if (name !== myName) {
      const div = document.createElement("div");

      div.innerHTML = `<button onclick="selectUser('${name}')">
                    ${name}
                </button>`;

      usersDiv.appendChild(div);
    }
  });
});

function selectUser(name) {
  currentChat = name;
  currentGroup = "";

  document.getElementById("welcome").innerText = "Chat dengan " + name;

  renderMessages();
}

socket.on("groups", (groups) => {
  const groupsDiv = document.getElementById("groups");

  groupsDiv.innerHTML = "";

  groups.forEach((group) => {
    const div = document.createElement("div");

    div.innerHTML = `<button onclick="joinGroup('${group}')">
                ${group}
            </button>`;

    groupsDiv.appendChild(div);
  });
});

function createGroup() {
  const groupName = document.getElementById("groupName").value.trim();

  if (!groupName) return;

  socket.emit("createGroup", groupName);

  document.getElementById("groupName").value = "";
}

function joinGroup(group) {
  currentGroup = group;
  currentChat = "";

  socket.emit("joinGroup", group);

  document.getElementById("welcome").innerText = "Grup: " + group;

  renderMessages();
}

function sendMessage() {
  const text = document.getElementById("message").value.trim();

  if (!text) return;

  if (currentChat) {
    socket.emit("privateMessage", {
      from: myName,
      to: currentChat,
      text: text,
    });

    allMessages.push({
      type: "private",
      from: myName,
      to: currentChat,
      text: text,
    });
  } else if (currentGroup) {
    socket.emit("groupMessage", {
      group: currentGroup,
      from: myName,
      text: text,
    });

    allMessages.push({
      type: "group",
      group: currentGroup,
      from: myName,
      text: text,
    });
  }

  document.getElementById("message").value = "";

  renderMessages();
}

socket.on("privateMessage", (data) => {
  allMessages.push({
    type: "private",
    from: data.from,
    to: myName,
    text: data.text,
  });

  renderMessages();
});

socket.on("groupMessage", (data) => {
  allMessages.push({
    type: "group",
    group: data.group,
    from: data.from,
    text: data.text,
  });

  renderMessages();
});

async function uploadFile() {
  const file = document.getElementById("fileInput").files[0];

  if (!file) {
    alert("Pilih foto");
    return;
  }

  const formData = new FormData();

  formData.append("file", file);

  const res = await fetch("/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (!data.success) return;

  if (currentChat) {
    socket.emit("imageMessage", {
      from: myName,
      to: currentChat,
      image: data.file,
    });

    allMessages.push({
      type: "image",
      from: myName,
      to: currentChat,
      image: data.file,
    });
  }

  renderMessages();
}

socket.on("imageMessage", (data) => {
  allMessages.push({
    type: "image",
    from: data.from,
    to: myName,
    image: data.image,
  });

  renderMessages();
});

function renderMessages() {
  const box = document.getElementById("messages");

  box.innerHTML = "";

  allMessages.forEach((msg) => {
    let show = false;

    if (msg.type === "private" || msg.type === "image") {
      if (
        (msg.from === myName && msg.to === currentChat) ||
        (msg.from === currentChat && msg.to === myName)
      ) {
        show = true;
      }
    }

    if (msg.type === "group" && msg.group === currentGroup) {
      show = true;
    }

    if (!show) return;

    const div = document.createElement("div");

    div.style.margin = "10px";

    div.style.textAlign = msg.from === myName ? "right" : "left";

    if (msg.type === "image") {
      div.innerHTML = `<b>${msg.from}</b><br>
                <img
                src="${msg.image}"
                style="
                max-width:250px;
                border-radius:10px;
                ">`;
    } else {
      div.innerHTML = `<b>${msg.from}</b><br>
                ${msg.text}`;
    }

    box.appendChild(div);
  });

  box.scrollTop = box.scrollHeight;
}

let peerConnection;
let localStream;

const rtcConfig = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

async function startVoiceCall() {
  if (!currentChat) {
    alert("Pilih teman dulu");
    return;
  }

  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  peerConnection = new RTCPeerConnection(rtcConfig);

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    document.getElementById("remoteAudio").srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("iceCandidate", {
        to: currentChat,
        candidate: event.candidate,
      });
    }
  };

  const offer = await peerConnection.createOffer();

  await peerConnection.setLocalDescription(offer);

  socket.emit("offer", {
    to: currentChat,
    from: myName,
    offer: offer,
  });
}

socket.on("offer", async (data) => {
  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  peerConnection = new RTCPeerConnection(rtcConfig);

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    document.getElementById("remoteAudio").srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("iceCandidate", {
        to: data.from,
        candidate: event.candidate,
      });
    }
  };

  await peerConnection.setRemoteDescription(data.offer);

  const answer = await peerConnection.createAnswer();

  await peerConnection.setLocalDescription(answer);

  socket.emit("answer", {
    to: data.from,
    answer: answer,
  });
});

socket.on("answer", async (data) => {
  await peerConnection.setRemoteDescription(data.answer);
});

socket.on("iceCandidate", async (data) => {
  if (peerConnection) {
    await peerConnection.addIceCandidate(data.candidate);
  }
});

function endCall() {
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      track.stop();
    });

    localStream = null;
  }

  if (peerConnection) {
    peerConnection.close();

    peerConnection = null;
  }

  const remoteAudio = document.getElementById("remoteAudio");

  if (remoteAudio) {
    remoteAudio.srcObject = null;
  }

  const localVideo = document.getElementById("localVideo");

  if (localVideo) {
    localVideo.srcObject = null;
  }

  const remoteVideo = document.getElementById("remoteVideo");

  if (remoteVideo) {
    remoteVideo.srcObject = null;
  }

  document.getElementById("endCallBtn").style.display = "none";

  alert("Panggilan dihentikan");
}
