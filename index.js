const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");
let userRatingArray = [];

const {
    addUser,
    removeUser,
    getUser,
    getUsersInRoom,
    userLength,
} = require("./users");

const router = require("./router");

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
    cors: {
        origin: "http://pokker-planning.s3-website.ap-south-1.amazonaws.com/",
        methods: ["GET", "POST"],
    },
});

app.use(cors());
app.use(router);

io.on("connect", (socket) => {
    console.log("connect");
    socket.on("join", ({ name, room }, callback) => {
        const { error, user } = addUser({ id: socket.id, name, room });

        if (error) return callback(error);

        socket.join(user.room);

        socket.emit("message", {
            user: "admin",
            text: `${user.name}, welcome to room ${user.room}.`,
        });
        socket.broadcast
            .to(user.room)
            .emit("message", { user: "admin", text: `${user.name} has joined!` });

        io.to(user.room).emit("roomData", {
            room: user.room,
            users: getUsersInRoom(user.room),
        });

        callback();
    });

    socket.on("sendMessage", (message, callback) => {
        const user = getUser(socket.id);

        io.to(user.room).emit("message", { user: user.name, text: message });

        callback();
    });

    socket.on("send", (data) => {
        const user = getUser(socket.id);

        userRatingArray.push({
            ...user,
            rating: data,
        });
        let length = userLength();
        if (userRatingArray.length == length) {
            io.to(user.room).emit("receive", userRatingArray);
            userRatingArray = [];
        }
    });

    socket.on("disconnect", () => {
        const user = removeUser(socket.id);

        if (user) {
            io.to(user.room).emit("message", {
                user: "Admin",
                text: `${user.name} has left.`,
            });
            io.to(user.room).emit("roomData", {
                room: user.room,
                users: getUsersInRoom(user.room),
            });
        }
    });
});

server.listen(process.env.PORT || 5000, () =>
    console.log(`Server has started.`)
);