/**
 * useChat.js — shared Firebase chat hook for OJTern
 *
 * Firestore structure:
 *   conversations/{convId}                     ← convId = sorted [uid1,uid2].join("_")
 *     .participants: [uid1, uid2]
 *     .participantNames: { uid1: "Name A", uid2: "Name B" }
 *     .participantRoles: { uid1: "student", uid2: "company" }
 *     .lastMessage: { text, senderId, ts }
 *     .updatedAt: serverTimestamp
 *
 *   conversations/{convId}/messages/{msgId}
 *     .text: string
 *     .senderId: uid
 *     .ts: serverTimestamp
 *     .edited: bool
 *     .unsent: bool
 *     .attachment: { name, url, type } | null
 */

import { useState, useEffect, useCallback } from "react";
import {
  collection, doc, getDoc, setDoc, addDoc,
  updateDoc, deleteDoc, query, orderBy,
  onSnapshot, serverTimestamp, where, getDocs,
} from "firebase/firestore";
import { db } from "./firebase";

// ── helpers ───────────────────────────────────────────────────────────────────
export const makeConvId = (uid1, uid2) => [uid1, uid2].sort().join("_");

// Fetch display name + role for a uid by checking all 3 collections
export const resolveUser = async (uid) => {
  for (const col of ["students", "companies", "coordinators"]) {
    try {
      const snap = await getDoc(doc(db, col, uid));
      if (snap.exists()) {
        const d = snap.data();
        return {
          uid,
          name: d.companyName || d.fullName || d.name || d.firstName || d.displayName || "User",
          role: col.slice(0, -1), // "student" | "compan" | "coordinator"  — fixed below
          collection: col,
        };
      }
    } catch (_) {}
  }
  return { uid, name: "Unknown", role: "unknown", collection: null };
};

// ── main hook ─────────────────────────────────────────────────────────────────
/**
 * @param {string} myUid       — current user's Firebase uid
 * @param {string} myName      — current user's display name
 * @param {string} myRole      — "student" | "company" | "coordinator"
 */
export const useChat = (myUid, myName, myRole) => {
  const [contacts, setContacts]   = useState([]);   // [{ id, name, role, convId }]
  const [messages, setMessages]   = useState({});   // { [convId]: Message[] }
  const [loading,  setLoading]    = useState(true);
  const [unsubMap, setUnsubMap]   = useState({});   // { [convId]: unsubscribe }

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
      const convList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

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

        return { id: otherUid, name: otherName, role: otherRole, convId: conv.id, lastMessage: conv.lastMessage || null };
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
                attachment: data.attachment || null,
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
          attachment: data.attachment || null,
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
      // Update names in case they were previously "User" or undefined
      await updateDoc(convRef, {
        [`participantNames.${myUid}`]: resolvedMyName,
        [`participantNames.${otherUid}`]: resolvedOtherName,
      });
    }

    // Add to local contacts if not already there
    setContacts(prev => {
      if (prev.find(c => c.id === otherUid)) return prev;
      return [...prev, { id: otherUid, name: resolvedOtherName, role: otherRole, convId }];
    });

    return convId;
  }, [myUid, myName, myRole]);

  // ── Send a new message ──────────────────────────────────────────────────
  const sendMessage = useCallback(async (convId, { text, attachment }) => {
    if (!convId || (!text?.trim() && !attachment)) return;

    const msgRef = collection(db, "conversations", convId, "messages");
    await addDoc(msgRef, {
      text:       text?.trim() || "",
      senderId:   myUid,
      ts:         serverTimestamp(),
      edited:     false,
      unsent:     false,
      attachment: attachment || null,
    });

    // Update conversation's lastMessage + updatedAt
    await updateDoc(doc(db, "conversations", convId), {
      lastMessage: { text: text?.trim() || (attachment ? "📎 Attachment" : ""), senderId: myUid, ts: serverTimestamp() },
      updatedAt:   serverTimestamp(),
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
  }, []);

  // ── Delete entire conversation (local only — clears UI, keeps Firestore) ─
  const deleteConversation = useCallback(async (convId) => {
    // Optionally mark as deleted for this user without removing for the other
    // For now: delete all messages from Firestore for a true wipe
    const msgsSnap = await getDocs(collection(db, "conversations", convId, "messages"));
    await Promise.all(msgsSnap.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(doc(db, "conversations", convId));

    setContacts(prev => prev.filter(c => c.convId !== convId));
    setMessages(prev => { const n = { ...prev }; delete n[convId]; return n; });
  }, []);

  return {
    contacts,
    messages,
    loading,
    openConversation,
    ensureConversation,
    sendMessage,
    editMessage,
    unsendMessage,
    deleteConversation,
  };
};