import { jwtVerify } from "jose";

const socketAuth = async (socket, next) => {
  let token =
    socket.handshake.auth?.token || socket.handshake.headers["authorization"];
  console.log("Socket auth token:", token ? "Present" : "Absent");
  if (
    token === undefined ||
    token === null ||
    token === "" ||
    token === "null" ||
    token === "undefined"
  ) {
    return next(); // wie bei dir: wenn kein Token -> durchlassen
  }

  token = token.replace("Bearer ", "");

  if (
    token === undefined ||
    token === null ||
    token === "" ||
    token === "null" ||
    token === "undefined"
  ) {
    return next();
  }

  try {
    const data = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_KEY)
    );

    // analog zu req.userId / req.token → jetzt direkt am Socket speichern
    socket.userId = data.payload._id;
    socket.token = token;
    console.log("Socket authenticated for user-ID:", socket.userId);
    
    next();
  } catch (error) {
    console.log(error);
    next(new Error("Not authorized to access this resource"));
  }
};

export default socketAuth;
