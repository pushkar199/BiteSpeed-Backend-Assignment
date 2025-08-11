import { Database } from "sqlite";
import { Request, Response } from "express";
import { Contact, IdentifyRequest } from "./types";

// Helper to query contacts by email or phone
async function findMatchingContacts(db: Database, email?: string, phoneNumber?: string): Promise<Contact[]> {
  const rows = await db.all<Contact[]>(
    `SELECT * FROM contacts WHERE (email IS NOT NULL AND lower(email) = lower(?)) OR (phoneNumber IS NOT NULL AND phoneNumber = ?)`,
    email || null,
    phoneNumber || null
  );
  return rows || [];
}

// Generic fetch by ids
async function fetchByIds(db: Database, ids: number[]): Promise<Contact[]> {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  return db.all<Contact[]>(
    `SELECT * FROM contacts WHERE id IN (${placeholders})`,
    ...ids
  );
}

export async function identifyHandler(db: Database, req: Request, res: Response) {
  try {
    const body: IdentifyRequest = req.body ?? {};
    const email = body.email ?? null;
    const phoneNumber = body.phoneNumber ?? null;

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: "At least email or phoneNumber must be provided" });
    }

    // 1) Find direct matches
    const direct = await findMatchingContacts(db, email ?? undefined, phoneNumber ?? undefined);

    // 2) If no direct matches, create primary
    if (direct.length === 0) {
      const insert = await db.run(
        `INSERT INTO contacts (email, phoneNumber, linkPrecedence) VALUES (?, ?, 'primary')`,
        email,
        phoneNumber
      );
      const newId = insert.lastID;
      return res.json({
        contact: {
          primaryContatctId: newId,
          emails: email ? [email] : [],
          phoneNumbers: phoneNumber ? [phoneNumber] : [],
          secondaryContactIds: []
        }
      });
    }

    // 3) Build set of connected ids via iterative expansion
    const allContacts = await db.all<Contact[]>(`SELECT * FROM contacts`);
    const adj = new Map<number, Set<number>>();
    allContacts.forEach(c => adj.set(c.id, new Set<number>()));

    for (let i = 0; i < allContacts.length; i++) {
      for (let j = i + 1; j < allContacts.length; j++) {
        const a = allContacts[i];
        const b = allContacts[j];
        const sharesEmail = a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase();
        const sharesPhone = a.phoneNumber && b.phoneNumber && a.phoneNumber === b.phoneNumber;
        const linkedRelation = (a.linkedId && a.linkedId === b.id) || (b.linkedId && b.linkedId === a.id);
        if (sharesEmail || sharesPhone || linkedRelation) {
          adj.get(a.id)!.add(b.id);
          adj.get(b.id)!.add(a.id);
        }
      }
    }

    // start BFS from all direct matches
    const seedIds = Array.from(new Set(direct.map(d => d.id)));
    const visited = new Set<number>(seedIds);
    const queue = [...seedIds];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of adj.get(cur) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }

    const component = allContacts.filter(c => visited.has(c.id));
    // pick oldest createdAt as primary (tie-breaker id)
    component.sort((a,b) => {
      const t1 = new Date(a.createdAt).getTime();
      const t2 = new Date(b.createdAt).getTime();
      return t1 - t2 || a.id - b.id;
    });
    const primary = component[0];

    // convert other primaries to secondary if needed
    const updates: Promise<any>[] = [];
    for (const c of component) {
      if (c.id !== primary.id && c.linkPrecedence === "primary") {
        updates.push(db.run(`UPDATE contacts SET linkPrecedence='secondary', linkedId=? WHERE id=?`, primary.id, c.id));
      }
    }
    if (updates.length) await Promise.all(updates);

    // fetch related contacts (primary + its secondaries)
    const related = await db.all<Contact[]>(
      `SELECT * FROM contacts WHERE id = ? OR linkedId = ?`,
      primary.id,
      primary.id
    );

    // if incoming has new info, create secondary
    const emailsSet = new Set(related.map(r => r.email ? r.email.toLowerCase() : ""));
    const phonesSet = new Set(related.map(r => r.phoneNumber ?? ""));
    const needCreate = (email && !emailsSet.has(email.toLowerCase())) || (phoneNumber && !phonesSet.has(phoneNumber));
    if (needCreate) {
      await db.run(
        `INSERT INTO contacts (email, phoneNumber, linkPrecedence, linkedId) VALUES (?, ?, 'secondary', ?)`,
        email,
        phoneNumber,
        primary.id
      );
    }

    // final related fetch
    const finalRelated = await db.all<Contact[]>(
      `SELECT * FROM contacts WHERE id = ? OR linkedId = ?`,
      primary.id,
      primary.id
    );

    const primaryEmail = finalRelated.find(f => f.id === primary.id)?.email ?? null;
    const primaryPhone = finalRelated.find(f => f.id === primary.id)?.phoneNumber ?? null;

    const emails: string[] = [];
    const phones: string[] = [];
    if (primaryEmail) emails.push(primaryEmail);
    if (primaryPhone) phones.push(primaryPhone);
    for (const c of finalRelated) {
      if (c.id === primary.id) continue;
      if (c.email && !emails.map(e=>e.toLowerCase()).includes(c.email.toLowerCase())) emails.push(c.email);
      if (c.phoneNumber && !phones.includes(c.phoneNumber)) phones.push(c.phoneNumber);
    }

    const secondaryIds = finalRelated.filter(f => f.id !== primary.id).map(f => f.id);

    return res.json({
      contact: {
        primaryContatctId: primary.id,
        emails,
        phoneNumbers: phones,
        secondaryContactIds: secondaryIds
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
