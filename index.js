import { v4 as isuuidv4 } from "is-uuid";
import qrcode from "qrcode-terminal";
import WebSocket, { WebSocketServer } from "ws";
import axios from "axios";
import pkg from "./package.json" with { type: "json" };

const defaultName = process.env.DEFAULT_NAME;

const wss = new WebSocketServer({ port: process.env.PORT });

wss.on("connection", (client) => {
  client.on("message", (message) => {
    const data = JSON.parse(message);
    if (data.type === "function_call" && ws?.readyState === WebSocket.OPEN) {
      ws.send(message);
      return;
    }
    if (!data.sdk || !data.modules) return;
    client.service = data;
  });
  client.on("close", () => {
    delete client.service;
  });
});

let agentKey = process.env.KEY;

if (agentKey === undefined) {
  console.error("The variable environment KEY is required.");
  process.exit(1);
}

if (typeof agentKey !== "string") {
  console.error("The variable environment KEY must be a string.");
  process.exit(1);
}

agentKey = agentKey.trim().toLowerCase();

if (!isuuidv4(agentKey)) {
  console.error("The variable environment KEY must be a UUID v4.");
  process.exit(1);
}

console.log(`Agent Key: ${agentKey}`);
qrcode.generate(agentKey, { small: true }, (qr) => console.log(qr));

let ws = null;
function connect() {
  ws = new WebSocket(process.env.GATEWAY_URL);
  ws.on("open", () => {
    ws.send(
      JSON.stringify({
        type: "login",
        agentKey,
      })
    );
  });
  ws.on("message", (message) => {
    const data = JSON.parse(message);
    if (data.type === undefined) {
      return;
    }
    if (data.type === "function_call") {
      for (const client of [...wss.clients]) {
        if (client.readyState !== WebSocket.OPEN) continue;
        if (client.service === undefined) continue;
        for (const module of client.service.modules) {
          if (module.type !== "Extension") continue;
          if (module.name !== data.extensionName) continue;
          for (const functionSchema of module.functionSchemas) {
            if (data.name !== functionSchema.name) continue;
            client.send(message);
          }
        }
      }
    }
  });
  ws.on("close", () => {
    setTimeout(connect, 1000);
  });
}
connect();

const agent = {
  defaultName,
  version: pkg.version,
  services: [],
};
async function update() {
  const services = [];
  for (const client of [...wss.clients]) {
    if (client.readyState !== WebSocket.OPEN) continue;
    if (client.service === undefined) continue;
    services.push(client.service);
  }
  if (
    services.length !== agent.services.length ||
    services.some((service, i) => service !== agent.services[i])
  ) {
    agent.services = services;
    try {
      await axios.put(process.env.PUBLISHER_URL, agent, {
        headers: { "x-agent-key": agentKey },
      });
      setTimeout(update, 1000);
      return;
    } catch (error) {
      console.error(error.message);
      setTimeout(update, 5000);
      return;
    }
  }
  setTimeout(update, 500);
}
setTimeout(update, 2000);
