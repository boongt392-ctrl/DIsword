const express = require("express");
const path = require("path");
const http = require("http");
const fs = require("fs");
const multer = require("multer");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "../client")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const allowedUsers = ["Ghazy", "Andi", "Budi"];

let users = {};
let groups = {};

const MESSAGE_FILE = path.join(__dirname, "messages.json");

if (!fs.existsSync(MESSAGE_FILE)) {
  fs.writeFileSync(MESSAGE_FILE, "[]");
}

function loadMessages() {
  try {
    return JSON.parse(fs.readFileSync(MESSAGE_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveMessages(messages) {
  fs.writeFileSync(MESSAGE_FILE, JSON.stringify(messages, null, 2));
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(__dirname, "uploads"));
  },

  filename(req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

app.post("/upload", upload.single("file"), (req, res) => {
  res.json({
    success: true,
    file: "/uploads/" + req.file.filename,
  });
});

io.on("connection", (socket) => {
  socket.on("join", (name) => {
    if (!allowedUsers.includes(name)) {
      socket.emit("loginFailed", "Nama tidak terdaftar");
      return;
    }

    users[socket.id] = name;

    socket.emit("loginSuccess");

    socket.emit("messageHistory", loadMessages());

    socket.emit("groups", Object.keys(groups));

    io.emit("users", users);
  });

  socket.on("privateMessage", (data) => {
    const messages = loadMessages();

    messages.push({
      type: "private",
      from: data.from,
      to: data.to,
      text: data.text,
      time: new Date().toLocaleString(),
    });

    saveMessages(messages);

    const targetSocket = Object.keys(users).find((id) => users[id] === data.to);

    if (targetSocket) {
      io.to(targetSocket).emit("privateMessage", data);
    }
  });

  socket.on("imageMessage", (data) => {
    const messages = loadMessages();

    messages.push({
      type: "image",
      from: data.from,
      to: data.to,
      image: data.image,
      time: new Date().toLocaleString(),
    });

    saveMessages(messages);

    const targetSocket = Object.keys(users).find((id) => users[id] === data.to);

    if (targetSocket) {
      io.to(targetSocket).emit("imageMessage", data);
    }
  });

  socket.on("createGroup", (groupName) => {
    if (!groups[groupName]) {
      groups[groupName] = [];

      io.emit("groups", Object.keys(groups));
    }
  });

  socket.on("joinGroup", (groupName) => {
    const username = users[socket.id];

    if (!groups[groupName]) {
      groups[groupName] = [];
    }

    if (!groups[groupName].includes(username)) {
      groups[groupName].push(username);
    }

    socket.join(groupName);

    io.emit("groups", Object.keys(groups));
  });

  socket.on("groupMessage", (data) => {
    const messages = loadMessages();

    messages.push({
      type: "group",
      group: data.group,
      from: data.from,
      text: data.text,
      time: new Date().toLocaleString(),
    });

    saveMessages(messages);

    io.to(data.group).emit("groupMessage", data);
  });

  socket.on("offer", (data) => {
    const targetSocket = Object.keys(users).find((id) => users[id] === data.to);

    if (targetSocket) {
      io.to(targetSocket).emit("offer", data);
    }
  });

  socket.on("answer", (data) => {
    const targetSocket = Object.keys(users).find((id) => users[id] === data.to);

    if (targetSocket) {
      io.to(targetSocket).emit("answer", data);
    }
  });

  socket.on("iceCandidate", (data) => {
    const targetSocket = Object.keys(users).find((id) => users[id] === data.to);

    if (targetSocket) {
      io.to(targetSocket).emit("iceCandidate", data);
    }
  });

  socket.on("disconnect", () => {
    delete users[socket.id];

    io.emit("users", users);
  });
});

socket.on("offer", (data) => {
  io.to(data.to).emit("offer", data);
});

socket.on("answer", (data) => {
  io.to(data.to).emit("answer", data);
});

socket.on("iceCandidate", (data) => {
  io.to(data.to).emit("iceCandidate", data);
});

server.listen(3000, () => {
  console.log("Server berjalan di http://localhost:3000");
});
