import { promises as fs } from "fs";
import path from "path";

const QUEUE_DIR = process.env.TRANSFER_QUEUE_DIR || "/app/transfer-queue";

export interface TransferRequest {
  requestId: string;
  username: string;
  accountId: number;
  characterGuid: number;
  characterName: string;
  characterLevel: number;
  characterClass: string;
  characterRace: string;
  sourceRealm: "classic" | "tbc";
  targetRealm: "tbc" | "wotlk";
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
}

async function ensureQueueDir(): Promise<void> {
  try {
    await fs.mkdir(QUEUE_DIR, { recursive: true });
  } catch {
    // directory may already exist
  }
}

function generateRequestId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${ts}-${rand}`;
}

export async function saveTransferRequest(
  data: Omit<TransferRequest, "requestId" | "status" | "createdAt">
): Promise<TransferRequest> {
  await ensureQueueDir();

  const request: TransferRequest = {
    ...data,
    requestId: generateRequestId(),
    status: "queued",
    createdAt: new Date().toISOString(),
  };

  const filename = `${Date.now()}_${request.sourceRealm}_${request.targetRealm}_${request.characterGuid}.json`;
  const filepath = path.join(QUEUE_DIR, filename);

  await fs.writeFile(filepath, JSON.stringify(request, null, 2), "utf-8");
  return request;
}

export async function getTransferHistory(
  username: string
): Promise<TransferRequest[]> {
  await ensureQueueDir();

  try {
    const files = await fs.readdir(QUEUE_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const requests: TransferRequest[] = [];

    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(
          path.join(QUEUE_DIR, file),
          "utf-8"
        );
        const req: TransferRequest = JSON.parse(content);
        if (req.username === username) {
          requests.push(req);
        }
      } catch {
        // skip malformed files
      }
    }

    // Sort by creation date descending
    requests.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return requests;
  } catch {
    return [];
  }
}

export async function hasPendingTransfer(
  username: string,
  characterGuid: number,
  sourceRealm: string
): Promise<boolean> {
  const history = await getTransferHistory(username);
  return history.some(
    (r) =>
      r.characterGuid === characterGuid &&
      r.sourceRealm === sourceRealm &&
      r.status === "queued"
  );
}
