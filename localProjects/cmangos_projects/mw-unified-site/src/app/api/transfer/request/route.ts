import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, getCookieName } from "@/lib/jwt";
import { queryOne, RACES, CLASSES, type Patch } from "@/lib/db";
import { saveTransferRequest, type TransferRequest } from "@/lib/transfer-queue";
import { executeTransfer } from "@/lib/transfer-engine";
import type { RowDataPacket } from "mysql2/promise";

interface CharRow extends RowDataPacket {
  guid: number;
  name: string;
  level: number;
  race: number;
  class: number;
  account: number;
  online: number;
}

const VALID_TRANSFERS: Record<string, Patch> = {
  "classic:tbc": "tbc",
  "tbc:wotlk": "wotlk",
};

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(getCookieName());

    if (!tokenCookie) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const payload = verifyToken(tokenCookie.value);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { characterGuid, sourceRealm, targetRealm } = body;

    // Validate input
    if (!characterGuid || !sourceRealm || !targetRealm) {
      return NextResponse.json(
        { error: "Missing required fields: characterGuid, sourceRealm, targetRealm" },
        { status: 400 }
      );
    }

    if (sourceRealm !== "classic" && sourceRealm !== "tbc") {
      return NextResponse.json(
        { error: "sourceRealm must be 'classic' or 'tbc'" },
        { status: 400 }
      );
    }

    if (targetRealm !== "tbc" && targetRealm !== "wotlk") {
      return NextResponse.json(
        { error: "targetRealm must be 'tbc' or 'wotlk'" },
        { status: 400 }
      );
    }

    // Validate transfer direction
    const transferKey = `${sourceRealm}:${targetRealm}`;
    if (!VALID_TRANSFERS[transferKey]) {
      return NextResponse.json(
        { error: "Invalid transfer direction. Only classic->tbc and tbc->wotlk are allowed." },
        { status: 400 }
      );
    }

    // Verify user has account on source realm
    const sourceAccountId = payload.accounts[sourceRealm as Patch];
    if (!sourceAccountId) {
      return NextResponse.json(
        { error: "No account linked on source realm" },
        { status: 400 }
      );
    }

    // Verify character exists and belongs to this user on source realm
    const sourceChar = await queryOne<CharRow>(
      sourceRealm as Patch,
      "char",
      "SELECT guid, name, level, race, class, account, online FROM characters WHERE guid = ? AND account = ?",
      [characterGuid, sourceAccountId]
    );

    if (!sourceChar) {
      return NextResponse.json(
        { error: "Character not found on source realm or does not belong to your account" },
        { status: 404 }
      );
    }

    // Character must be offline
    if (sourceChar.online !== 0) {
      return NextResponse.json(
        { error: "Character must be logged out before transferring. Please disconnect and try again." },
        { status: 409 }
      );
    }

    // Verify user has account on target realm
    const targetAccountId = payload.accounts[targetRealm as Patch];
    if (!targetAccountId) {
      return NextResponse.json(
        { error: "No account linked on target realm. Please ensure your account is linked to the target expansion." },
        { status: 400 }
      );
    }

    // Check if character with same name already exists on target realm
    const existingChar = await queryOne<CharRow>(
      targetRealm as Patch,
      "char",
      "SELECT guid, name FROM characters WHERE name = ?",
      [sourceChar.name]
    );

    if (existingChar) {
      return NextResponse.json(
        { error: `Character "${sourceChar.name}" already exists on the target realm` },
        { status: 409 }
      );
    }

    // Execute transfer immediately
    const result = await executeTransfer(
      sourceRealm as "classic" | "tbc",
      targetRealm as "tbc" | "wotlk",
      characterGuid,
      sourceAccountId,
      targetAccountId,
    );

    // Save a record of the transfer (completed or failed)
    const transferRecord = await saveTransferRequest({
      username: payload.username,
      accountId: sourceAccountId,
      characterGuid,
      characterName: sourceChar.name,
      characterLevel: sourceChar.level,
      characterClass: CLASSES[sourceChar.class] || `Class ${sourceChar.class}`,
      characterRace: RACES[sourceChar.race] || `Race ${sourceChar.race}`,
      sourceRealm: sourceRealm as "classic" | "tbc",
      targetRealm: targetRealm as "tbc" | "wotlk",
    });

    // Update the saved record status based on result
    if (result.success) {
      await updateTransferStatus(transferRecord, "completed");
      return NextResponse.json({
        status: "ok",
        message: result.message,
        requestId: transferRecord.requestId,
        newGuid: result.newGuid,
      });
    } else {
      await updateTransferStatus(transferRecord, "failed");
      return NextResponse.json(
        { error: result.message, requestId: transferRecord.requestId },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[transfer/request] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/** Update the JSON file status after transfer execution */
async function updateTransferStatus(
  record: TransferRequest,
  status: "completed" | "failed",
) {
  try {
    const { promises: fs } = require("fs");
    const path = require("path");
    const QUEUE_DIR = process.env.TRANSFER_QUEUE_DIR || "/app/transfer-queue";
    const files: string[] = await fs.readdir(QUEUE_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const filepath = path.join(QUEUE_DIR, file);
      const content = await fs.readFile(filepath, "utf-8");
      const data = JSON.parse(content);
      if (data.requestId === record.requestId) {
        data.status = status;
        await fs.writeFile(filepath, JSON.stringify(data, null, 2), "utf-8");
        break;
      }
    }
  } catch {
    // non-critical: the transfer succeeded/failed regardless of logging
    console.warn("[transfer/request] Could not update transfer record status");
  }
}
