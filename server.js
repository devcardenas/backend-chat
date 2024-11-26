const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const socketIo = require("socket.io");

// Crear aplicación Express
const app = express();

// Configuración de Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Permitir solicitudes desde cualquier origen
    methods: ["GET", "POST"],
  },
});

// Conexión a MongoDB
mongoose
  .connect("mongodb://localhost:27017/chat")
  .then(() => console.log("Conectado a MongoDB"))
  .catch((err) => console.error("Error al conectar a MongoDB:", err));

// Modelo de Mensaje
const Message = mongoose.model(
  "Message",
  new mongoose.Schema({
    username: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  })
);

// Modelo de Usuarios conectados
const User = mongoose.model(
  "User",
  new mongoose.Schema({
    idSocket: { type: String, required: true },
    username: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  })
);

// Middleware
app.use(cors());
app.use(express.json()); // Para parsear JSON en las solicitudes

// Rutas
app.get("/api/messages", async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 1 }); // Ordenar por tiempo ascendente
    res.json(messages);
  } catch (err) {
    res.status(500).send("Error al obtener los mensajes");
  }
});

// devuelve los usuarios conectados en vivo
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).send("Error al obtener los usuarios, error: " + err);
  }
});

// Manejo de Socket.IO
io.on("connection", async (socket) => {
  const username = socket.handshake.query.username;
  console.log(`Usuario conectado: ${username} (ID: ${socket.id})`);

  // Registrar usuario conectado en la base de datos
  // Guardar el usuario en la base de datos
  try {
    const user = await User.create({ idSocket: socket.id, username });
    console.log("Usuario registrado:", user);
  } catch (err) {
    console.error("Error al registrar el usuario:", err);
  }

  // Recibir nuevo mensaje
  socket.on("new-message", async (data) => {
    try {
      const message = await Message.create(data); // Guardar mensaje en MongoDB
      io.emit("message-received", message); // Enviar mensaje a todos los clientes conectados
    } catch (err) {
      console.error("Error al guardar el mensaje:", err);
    }
  });

  socket.on("disconnect", async () => {
    console.log(`Usuario desconectado: ${username} (ID: ${socket.id})`);
    // Eliminar usuario de la base de datos
    const result = await User.findOneAndDelete({ idSocket: socket.id });
    if (result) {
      console.log("Documento eliminado:", result);
    } else {
      console.log("No se encontró el documento.");
    }
  });
});

// Iniciar servidor
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
