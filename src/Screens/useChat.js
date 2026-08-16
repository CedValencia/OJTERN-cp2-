/**
 * useChat.js — shared Firebase chat hook for OJTern
 *
 * Firestore structure:
 *   conversations/{convId}                     ← convId = sorted [uid1,uid2].join("_")
 *     .participants: [uid1, uid2]
 *     .participantNames: { uid1: "Name A", uid2: "Name B" }
 *     .participantRoles: { uid1: "student", uid2: "company" }
 *     .lastMessage: { text, senderId, ts }
 *     .lastRead: { uid: serverTimestamp }  ← per-user "I've seen up to this point" marker, persisted across devices/sessions
 *     .updatedAt: serverTimestamp
 *     .deletedFor: [uid, ...]           ← hides conv from that uid's Chats list until a new message arrives
 *     .clearedAt: { uid: serverTimestamp } ← that uid's permanent "hide history before this point" cutoff
 *
 *   conversations/{convId}/messages/{msgId}
 *     .text: string
 *     .senderId: uid
 *     .ts: serverTimestamp
 *     .edited: bool
 *     .unsent: bool
 *     .attachments: [{ name, url, type }, ...] | null
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  collection, doc, getDoc, setDoc, addDoc,
  updateDoc, deleteDoc, query, orderBy, limit,
  onSnapshot, serverTimestamp, where, getDocs, arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";

// ── helpers ───────────────────────────────────────────────────────────────────
export const makeConvId = (uid1, uid2) => [uid1, uid2].sort().join("_");

// ✅ ADD THIS — builds "First M. Last Suffix", skipping missing parts
const buildFullName = (p = {}) => {
  const hasSuffix = p.suffix && p.suffix !== "N/A" && p.suffix !== "None";
  const parts = [
    p.firstName,
    p.middleInitial ? (p.middleInitial.endsWith(".") ? p.middleInitial : `${p.middleInitial}.`) : "",
    p.lastName,
    hasSuffix ? p.suffix : "",
  ].filter(Boolean);
  return parts.join(" ").trim() || "User";
};

const ROLE_MAP = { students: "student", companies: "company", coordinators: "coordinator" };

// Fetch display name + role for a uid by checking all 3 collections
export const resolveUser = async (uid) => {
  for (const col of ["students", "companies", "coordinators"]) {
    try {
      const snap = await getDoc(doc(db, col, uid));
      if (snap.exists()) {
        const d = snap.data();
        const composedName = buildFullName(d);
        const name =
          d.companyName ||
          d.fullName ||
          (composedName !== "User" ? composedName : null) ||
          d.name ||
          d.displayName ||
          "User";
        return {
          uid,
          name,
          role: ROLE_MAP[col],   // ✅ fixed "companie" typo
          collection: col,
        };
      }
    } catch (_) {}
  }
  return { uid, name: "Unknown", role: "unknown", collection: null };
};

export { buildFullName };

// ── main hook ─────────────────────────────────────────────────────────────────
/**
 * @param {string} myUid       — current user's Firebase uid
 * @param {string} myName      — current user's display name
 * @param {string} myRole      — "student" | "company" | "coordinator"
 */
export const useChat = (myUid, myName, myRole) => {
  const [contacts, setContacts]   = useState([]);   // [{ id, name, role, convId }]
  const [messages, setMessages]   = useState({});   // { [convId]: Message[] } — raw, unfiltered
  const [loading,  setLoading]    = useState(true);
  const [unsubMap, setUnsubMap]   = useState({});   // { [convId]: unsubscribe }
  // { [convId]: ms } — this user's own "cleared history before this point"
  // cutoff, from conv.clearedAt[myUid]. Messages at/before this cutoff are
  // hidden from THIS user's view only; the shared messages subcollection
  // and the other participant's view are untouched.
  const [clearedAtMap, setClearedAtMap] = useState({});

  // ── Load all conversations for this user ────────────────────────────────
  useEffect(() => {
    if (!myUid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", myUid),
    );

    const unsub = onSnapshot(q, async (snap) => {
      const allConvs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Capture each conversation's clear-cutoff for THIS user (if any),
      // independent of whether the conversation is currently hidden.
      const newClearedAtMap = {};
      allConvs.forEach(conv => {
        const clearedSeconds = conv.clearedAt?.[myUid]?.seconds;
        if (clearedSeconds) newClearedAtMap[conv.id] = clearedSeconds * 1000;
      });
      setClearedAtMap(newClearedAtMap);

      const convList = allConvs
        // Skip conversations this user has deleted for themself — the doc
        // still exists (and is still visible to the other participant)
        // until it's revived by a new message. See sendMessage below.
        .filter(conv => !(conv.deletedFor || []).includes(myUid))
        // Skip conversations with no lastMessage — only show chats that have
        // actual messages. This prevents "Message Now" button clicks from
        // creating chat entries that clutter the list. Conversations are
        // automatically shown once a message is sent.
        .filter(conv => conv.lastMessage !== null && conv.lastMessage !== undefined);

      // Build contacts list — always use latest name from Firestore collections
      const newContacts = await Promise.all(convList.map(async (conv) => {
        const otherUid   = conv.participants.find(p => p !== myUid);
        const storedName = conv.participantNames?.[otherUid];
        const otherRole  = conv.participantRoles?.[otherUid] || "unknown";

        // Always resolve from Firestore to get latest name (handles name changes)
        const resolved = await resolveUser(otherUid);
        const otherName = resolved.name !== "User" && resolved.name !== "Unknown"
          ? resolved.name
          : storedName || "User";

        // Also update participantNames in conversation if name changed
        if (storedName !== otherName) {
          updateDoc(doc(db, "conversations", conv.id), {
            [`participantNames.${otherUid}`]: otherName,
          }).catch(() => {});
        }

        return { id: otherUid, name: otherName, role: otherRole, convId: conv.id, lastMessage: conv.lastMessage || null, lastRead: conv.lastRead || {} };
      }));
      setContacts(newContacts);
      setLoading(false);

      // Auto-subscribe to messages for all existing conversations
      newContacts.forEach(c => {
        if (!c.convId) return;
        const q = query(
          collection(db, "conversations", c.convId, "messages"),
          orderBy("ts", "asc"),
        );
        setUnsubMap(prev => {
          if (prev[c.convId]) return prev; // already subscribed
          const unsub = onSnapshot(q, (snap) => {
            const msgs = snap.docs.map(d => {
              const data = d.data();
              return {
                id:         d.id,
                text:       data.text || "",
                sender:     data.senderId === myUid ? "me" : "them",
                senderId:   data.senderId,
                ts:         data.ts?.seconds ? data.ts.seconds * 1000 : Date.now(),
                edited:     data.edited || false,
                unsent:     data.unsent || false,
                attachments: data.attachments || (data.attachment ? [data.attachment] : []),
              };
            });
            setMessages(prev => ({ ...prev, [c.convId]: msgs }));
          });
          return { ...prev, [c.convId]: unsub };
        });
      });
    }, () => setLoading(false));

    return () => unsub();
  }, [myUid]);

  // ── Subscribe to messages for a specific conversation ───────────────────
  const openConversation = useCallback((convId) => {
    if (!convId || unsubMap[convId]) return;

    const q = query(
      collection(db, "conversations", convId, "messages"),
      orderBy("ts", "asc"),
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => {
        const data = d.data();
        return {
          id:         d.id,
          text:       data.text || "",
          sender:     data.senderId === myUid ? "me" : "them",
          senderId:   data.senderId,
          ts:         data.ts?.seconds ? data.ts.seconds * 1000 : Date.now(),
          edited:     data.edited || false,
          unsent:     data.unsent || false,
          attachments: data.attachments || (data.attachment ? [data.attachment] : []),
        };
      });
      setMessages(prev => ({ ...prev, [convId]: msgs }));
    });

    setUnsubMap(prev => ({ ...prev, [convId]: unsub }));
  }, [myUid, unsubMap]);

  // Cleanup message listeners on unmount
  useEffect(() => {
    return () => Object.values(unsubMap).forEach(fn => fn());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Ensure a conversation exists, return convId ─────────────────────────
  const ensureConversation = useCallback(async (otherUid, otherName, otherRole) => {
    // Guard — never write a conversation doc if either UID is missing
    if (!myUid || !otherUid) {
      console.error("ensureConversation: missing uid", { myUid, otherUid });
      throw new Error("Cannot start conversation: missing user ID.");
    }

    const convId  = makeConvId(myUid, otherUid);
    const convRef = doc(db, "conversations", convId);
    const snap    = await getDoc(convRef);

    // Resolve names — never store undefined in Firestore
    let resolvedMyName    = myName    || "User";
    let resolvedOtherName = otherName || "User";
    if (!myName || myName === "User" || myName === "Student" || myName === "Company" || myName === "Coordinator") {
      const me = await resolveUser(myUid);
      resolvedMyName = me.name;
    }
    if (!otherName || otherName === "User" || otherName === "Student" || otherName === "Company" || otherName === "Coordinator") {
      const other = await resolveUser(otherUid);
      resolvedOtherName = other.name;
    }

    if (!snap.exists()) {
      await setDoc(convRef, {
        participants:     [myUid, otherUid],
        participantNames: { [myUid]: resolvedMyName, [otherUid]: resolvedOtherName },
        participantRoles: { [myUid]: myRole || "unknown", [otherUid]: otherRole || "unknown" },
        lastMessage:      null,
        updatedAt:        serverTimestamp(),
        createdAt:        serverTimestamp(),
      });
    } else {
      // Update names in case they were previously "User" or undefined.
      // NOTE: intentionally NOT touching `deletedFor` here — merely opening
      // a chat (e.g. via "Message Now" on a company/coordinator profile)
      // should not revive a conversation the user deleted. Only an actual
      // new message (see sendMessage below) brings a deleted conversation
      // back, Messenger-style.
      await updateDoc(convRef, {
        [`participantNames.${myUid}`]: resolvedMyName,
        [`participantNames.${otherUid}`]: resolvedOtherName,
      });
    }

    // NOTE: Do NOT add to contacts here. Conversations should only appear in the chat list
    // after an actual message has been sent (see sendMessage). Merely opening the message
    // screen ("Message Now") should not create a visible chat entry.

    return convId;
  }, [myUid, myName, myRole]);

  // ── Send a new message ──────────────────────────────────────────────────
  const sendMessage = useCallback(async (convId, { text, attachments }) => {
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    if (!convId || (!text?.trim() && !hasAttachments)) return;

    const msgRef = collection(db, "conversations", convId, "messages");
    await addDoc(msgRef, {
      text:        text?.trim() || "",
      senderId:    myUid,
      ts:          serverTimestamp(),
      edited:      false,
      unsent:      false,
      attachments: hasAttachments ? attachments : null,
    });

    // Update conversation's lastMessage + updatedAt. Also clear deletedFor —
    // a new message should bring the conversation back for anyone who'd
    // deleted it on their side (e.g. Messenger-style revival).
    await updateDoc(doc(db, "conversations", convId), {
      lastMessage: {
        text: text?.trim() || (hasAttachments
          ? (attachments.length > 1 ? `📎 ${attachments.length} Attachments` : "📎 Attachment")
          : ""),
        senderId: myUid, ts: serverTimestamp(),
      },
      updatedAt:   serverTimestamp(),
      deletedFor:  [],
    });
  }, [myUid]);

  // ── Edit a message ──────────────────────────────────────────────────────
  const editMessage = useCallback(async (convId, msgId, newText) => {
    await updateDoc(doc(db, "conversations", convId, "messages", msgId), {
      text:   newText,
      edited: true,
    });
  }, []);

  // ── Unsend (soft-delete) a message ──────────────────────────────────────
  const unsendMessage = useCallback(async (convId, msgId) => {
    await updateDoc(doc(db, "conversations", convId, "messages", msgId), {
      unsent: true,
      text:   "",
    });

    // The Chats list preview reads conversations/{convId}.lastMessage, which is
    // a separate snapshot set at send-time — unsending a message doesn't touch
    // it. Recompute it from the actual latest message so the preview updates
    // too (e.g. shows "Unsent Message" if the unsent one was the most recent).
    try {
      const latestSnap = await getDocs(
        query(collection(db, "conversations", convId, "messages"), orderBy("ts", "desc"), limit(1))
      );
      if (!latestSnap.empty) {
        const latest = latestSnap.docs[0].data();
        await updateDoc(doc(db, "conversations", convId), {
          lastMessage: {
            text:     latest.unsent ? "Unsent Message" : (latest.text || ((latest.attachments?.length || latest.attachment) ? (latest.attachments?.length > 1 ? `📎 ${latest.attachments.length} Attachments` : "📎 Attachment") : "")),
            senderId: latest.senderId,
            ts:       latest.ts,
          },
        });
      }
    } catch (err) {
      console.error("Failed to refresh lastMessage after unsend:", err);
    }
  }, []);

  // ── Delete conversation — per-user only. Hides it from the caller's Chats
  //    list (until revived by a new message, see sendMessage) AND
  //    permanently hides all message history up to this point — for the
  //    caller only. The doc, the messages themselves, and the other
  //    participant's view are untouched.
  const deleteConversation = useCallback(async (convId) => {
    if (!myUid) return;
    await updateDoc(doc(db, "conversations", convId), {
      deletedFor: arrayUnion(myUid),
      [`clearedAt.${myUid}`]: serverTimestamp(),
    });

    setContacts(prev => prev.filter(c => c.convId !== convId));
    setMessages(prev => { const n = { ...prev }; delete n[convId]; return n; });
  }, [myUid]);

  // ── Mark a conversation as read (by this user) up to now — persisted to
  //    Firestore so it survives refreshes, new sessions, and other devices ──
  const markConversationRead = useCallback(async (convId) => {
    if (!myUid || !convId) return;
    try {
      await updateDoc(doc(db, "conversations", convId), {
        [`lastRead.${myUid}`]: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to mark conversation as read:", err);
    }
  }, [myUid]);

  // Messages as this user should see them — raw messages minus anything at
  // or before their own clearedAt cutoff for that conversation.
  const visibleMessages = useMemo(() => {
    const out = {};
    Object.keys(messages).forEach(convId => {
      const cutoff = clearedAtMap[convId] || 0;
      out[convId] = (messages[convId] || []).filter(m => m.ts > cutoff);
    });
    return out;
  }, [messages, clearedAtMap]);

  return {
    contacts,
    messages: visibleMessages,
    loading,
    openConversation,
    ensureConversation,
    sendMessage,
    editMessage,
    unsendMessage,
    deleteConversation,
    markConversationRead,
  };
};