import { v4 as isuuidv4 } from "is-uuid";
import crypto from "crypto";
import qrcode from "qrcode-terminal";
import WebSocket, { WebSocketServer } from "ws";
import axios from "axios";
import pkg from "./package.json" assert { type: "json" };

const defaultName = process.env.DEFAULT_NAME;

const wss = new WebSocketServer({ port: process.env.PORT });

function getClients() {
  return [...wss.clients].filter(
    (client) =>
      client.readyState === WebSocket.OPEN && client.service !== undefined
  );
}

function getServices() {
  return getClients().map((client) => client.service);
}

function getClientsWithServices() {
  return getClients().map((client) => ({ client, services: client.service }));
}

function getClientsWithModules() {
  return getClientsWithServices().flatMap(({ client, services }) =>
    services.modules.map((module) => ({ client, module }))
  );
}

function getClientsWithExtensions() {
  return getClientsWithModules().filter(
    ({ module }) => module.type === "Extension"
  );
}

function getClientsWithFunctionSchemas() {
  return getClientsWithExtensions().flatMap(({ client, module }) =>
    module.functionSchemas.map((fn) => ({ client, fn }))
  );
}

function getClientsByFunctionSchemaName(name) {
  return [
    ...new Set(
      getClientsWithFunctionSchemas()
        .filter(({ fn }) => fn.name === name)
        .map(({ client }) => client)
    ),
  ];
}

wss.on("connection", (client) => {
  client.on("message", (message) => {
    const data = JSON.parse(message);
    if (data.type === "function_call" && ws?.readyState === WebSocket.OPEN) {
      ws.send(message);
      return;
    }
    if (!data.sdk || !data.modules) return;
    data.modules.forEach((module) => {
      if (module.type !== "Extension") return;
      const extension = module;
      if (!extension.functionSchemas.length) return;
      extension.functionSchemas.forEach(
        (schema) => (schema.name = `${schema.name}_${extension.id}`)
      );
      module.instructions = `**The functions related to this extension are suffixed by "_${extension.id}"**.\n\n${module.instructions}`;
    });
    client.service = data;
  });
  client.on("close", () => {
    delete client.service;
  });
});

const key = process.env.KEY;

if (key === undefined) {
  console.error("The variable environment KEY is required.");
  process.exit(1);
}

if (!isuuidv4(key)) {
  console.error("The variable environment KEY must be a UUID v4.");
  process.exit(1);
}

console.log(`Agent Key: ${key}`);
qrcode.generate(key, { small: true }, (qr) => console.log(qr));

let ws = null;
function connect() {
  ws = new WebSocket(process.env.GATEWAY_URL);
  ws.on("open", () => {
    ws.send(
      JSON.stringify({
        type: "login",
        key,
      })
    );
  });
  ws.on("message", (message) => {
    const data = JSON.parse(message);
    if (data.type === undefined) {
      return;
    }
    if (data.type === "function_call") {
      getClientsByFunctionSchemaName(data.name).forEach((client) => {
        client.send(message);
      });
    }
  });
  ws.on("close", () => {
    setTimeout(connect, 1000);
  });
}
connect();

let lastHash = null;
async function updateAgent() {
  const agent = {
    defaultName,
    version: pkg.version,
    services: getServices(),
  };
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(agent))
    .digest("hex");
  if (lastHash === hash) {
    setTimeout(updateAgent, 500);
    return;
  }
  try {
    await axios.put(process.env.PUBLISHER_URL, agent, {
      headers: { "x-key": key },
    });
  } catch (error) {
    console.error(error.message);
  }
  lastHash = hash;
  setTimeout(updateAgent, 1000);
}
updateAgent();
