import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_SOCKET_URL);
console.log("the socket url is--------------------------------------------------------------------------------------------------------", import.meta.env.VITE_SOCKET_URL);
export default socket;