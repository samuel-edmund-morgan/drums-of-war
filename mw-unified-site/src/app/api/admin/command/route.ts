import { NextRequest, NextResponse } from "next/server";
import { requireGM } from "@/lib/adminAuth";
import { Socket } from "net";

interface ServerConfig {
  name: string;
  host: string;
  port: number;
  protocol: "ra" | "soap";
}

const SERVERS: Record<string, ServerConfig> = {
  classic: { name: "Classic", host: "vmangos-mangosd", port: 7878, protocol: "soap" },
  tbc: { name: "TBC", host: "cmangos-tbc-server", port: 3443, protocol: "ra" },
  wotlk: { name: "WotLK", host: "azerothcore-worldserver", port: 3443, protocol: "ra" },
};

// RA credentials — uppercase password required for CMaNGOS SRP6 RA auth
const RA_USER = "ADMIN";
const RA_PASS = process.env.RA_PASSWORD || "NADVAP-PEVBUN-FUPTY0";
// SOAP credentials for VMaNGOS — uses account from realmd
const SOAP_USER = process.env.SOAP_USER || "ADMIN";
const SOAP_PASS = process.env.SOAP_PASS || "NADVAP-PEVBUN-FUPTY0";

async function sendRA(config: ServerConfig, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let output = "";
    let authenticated = false;
    let phase = 0; // 0=banner, 1=user_sent, 2=pass_sent, 3=cmd_sent

    socket.setTimeout(10000);

    socket.on("data", (data) => {
      const text = data.toString("utf-8");
      output += text;

      if (phase === 0) {
        // Banner received, send username
        phase = 1;
        socket.write(RA_USER + "\r\n");
      } else if (phase === 1) {
        // Username prompt response, send password
        phase = 2;
        socket.write(RA_PASS + "\r\n");
      } else if (phase === 2) {
        // Auth response
        if (text.includes("+") || text.includes("mangos>") || text.includes("AC>") || text.includes("Logged") || text.includes("Welcome to")) {
          authenticated = true;
          phase = 3;
          socket.write(command + "\r\n");
          // Give server time to respond, then close
          setTimeout(() => {
            socket.write("quit\r\n");
            setTimeout(() => socket.destroy(), 500);
          }, 1500);
        } else if (text.includes("failed") || text.includes("Wrong") || text.includes("-")) {
          socket.destroy();
          reject(new Error("RA authentication failed"));
        }
      }
      // phase 3: collecting command output, handled by close/end
    });

    socket.on("close", () => {
      if (!authenticated) {
        reject(new Error("Connection closed before auth"));
        return;
      }
      // Extract command output — everything after auth prompt, skip RA control lines
      const lines = output.split("\n");
      const cmdOutput: string[] = [];
      let capturing = false;
      for (const line of lines) {
        const clean = line.replace(/\r/g, "").trim();
        if (capturing) {
          if (clean === "quit" || clean === "") continue;
          if (clean === "mangos>" || clean === "AC>") continue;
          if (clean.startsWith("Username:") || clean.startsWith("Password:")) continue;
          if (clean.includes("Authentication Required")) continue;
          cmdOutput.push(clean);
        }
        if (clean.includes("Logged in") || clean.includes("+Logged") || clean.includes("Welcome to")) {
          capturing = true;
        }
      }
      resolve(cmdOutput.filter(l => l.length > 0).join("\n") || "(no output)");
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Connection timeout"));
    });

    socket.on("error", (err) => {
      reject(new Error(`Connection error: ${err.message}`));
    });

    socket.connect(config.port, config.host);
  });
}

async function sendSOAP(config: ServerConfig, command: string): Promise<string> {
  const auth = Buffer.from(`${SOAP_USER}:${SOAP_PASS}`).toString("base64");

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="urn:MaNGOS">
  <SOAP-ENV:Body>
    <ns1:executeCommand>
      <command>${command.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</command>
    </ns1:executeCommand>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

  const res = await fetch(`http://${config.host}:${config.port}/`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "Authorization": `Basic ${auth}`,
    },
    body: soapBody,
    signal: AbortSignal.timeout(10000),
  });

  const xml = await res.text();

  // Extract result or fault from XML
  const faultMatch = xml.match(/<faultstring>(.*?)<\/faultstring>/);
  if (faultMatch) throw new Error(faultMatch[1]);

  const resultMatch = xml.match(/<result>(.*?)<\/result>/s);
  return resultMatch ? resultMatch[1].trim() : "(no output)";
}

export async function POST(request: NextRequest) {
  const { error, payload } = await requireGM(3);
  if (error) return error;

  let body: { server?: string; command?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { server, command } = body;

  if (!server || !SERVERS[server]) {
    return NextResponse.json({ error: "Invalid server" }, { status: 400 });
  }

  if (!command || typeof command !== "string" || command.trim().length === 0) {
    return NextResponse.json({ error: "Command is required" }, { status: 400 });
  }

  const cmd = command.trim();

  // Audit log
  console.log(`[admin/command] ${payload?.username} → ${server}: ${cmd}`);

  const config = SERVERS[server];

  try {
    const output = config.protocol === "soap"
      ? await sendSOAP(config, cmd)
      : await sendRA(config, cmd);
    return NextResponse.json({
      status: "ok",
      server: config.name,
      command: cmd,
      output,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[admin/command] ${server} error:`, msg);
    return NextResponse.json({
      status: "error",
      server: config.name,
      command: cmd,
      error: msg,
    }, { status: 500 });
  }
}
