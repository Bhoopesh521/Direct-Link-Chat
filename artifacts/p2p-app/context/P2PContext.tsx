import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import TcpSocket from "react-native-tcp-socket";

export type ConnectionStatus =
  | "offline"
  | "connecting"
  | "connected"
  | "error";

export interface Peer {
  id: string;
  label: string;
  host: string;
  port: number;
  status: ConnectionStatus;
  lastSeen?: number;
}

export type MessageType = "text" | "file" | "file_chunk" | "file_end" | "ping" | "pong";

export interface P2PMessage {
  id: string;
  type: MessageType;
  from: string;
  to?: string;
  text?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  chunkIndex?: number;
  totalChunks?: number;
  data?: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  peerId: string;
  direction: "in" | "out";
  type: "text" | "file";
  text?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileData?: string;
  timestamp: number;
  status: "sending" | "sent" | "received";
}

export interface FileTransfer {
  id: string;
  peerId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  direction: "in" | "out";
  progress: number;
  status: "transferring" | "done" | "error";
  fileData?: string;
  chunks: string[];
  totalChunks: number;
  receivedChunks: number;
}

interface P2PContextValue {
  myPort: number;
  setMyPort: (port: number) => void;
  peers: Peer[];
  addPeer: (label: string, host: string, port: number) => void;
  removePeer: (id: string) => void;
  connectToPeer: (peerId: string) => void;
  disconnectPeer: (peerId: string) => void;
  sendTextMessage: (peerId: string, text: string) => void;
  sendFile: (peerId: string, fileName: string, fileSize: number, fileType: string, fileData: string) => void;
  messages: Record<string, ChatMessage[]>;
  transfers: FileTransfer[];
  serverRunning: boolean;
}

const P2PContext = createContext<P2PContextValue | null>(null);

const STORAGE_KEY_PEERS = "p2p_peers";
const STORAGE_KEY_PORT = "p2p_my_port";
const DEFAULT_PORT = 9876;
const CHUNK_SIZE = 32768;

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function P2PProvider({ children }: { children: React.ReactNode }) {
  const [myPort, setMyPortState] = useState<number>(DEFAULT_PORT);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const [serverRunning, setServerRunning] = useState(false);

  const serverRef = useRef<ReturnType<typeof TcpSocket.createServer> | null>(null);
  const socketsRef = useRef<Record<string, ReturnType<typeof TcpSocket.createConnection>>>({});
  const inboundSocketsRef = useRef<Record<string, ReturnType<typeof TcpSocket.createServer> extends { on: (e: string, cb: (socket: infer S) => void) => any } ? S : any>>({});
  const bufferRef = useRef<Record<string, string>>({});
  const pendingTransfersRef = useRef<Record<string, FileTransfer>>({});

  useEffect(() => {
    loadStoredData();
    return () => {
      stopServer();
      Object.values(socketsRef.current).forEach((s) => {
        try { s.destroy(); } catch (_) {}
      });
    };
  }, []);

  const loadStoredData = async () => {
    try {
      const [peersStr, portStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_PEERS),
        AsyncStorage.getItem(STORAGE_KEY_PORT),
      ]);
      if (peersStr) {
        const stored: Peer[] = JSON.parse(peersStr);
        setPeers(stored.map((p) => ({ ...p, status: "offline" as const })));
      }
      if (portStr) {
        setMyPortState(parseInt(portStr, 10));
      }
    } catch (_) {}
  };

  const savePeers = useCallback(async (updated: Peer[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_PEERS, JSON.stringify(updated));
    } catch (_) {}
  }, []);

  const setMyPort = useCallback((port: number) => {
    setMyPortState(port);
    AsyncStorage.setItem(STORAGE_KEY_PORT, port.toString());
    stopServer();
    setTimeout(() => startServer(port), 500);
  }, []);

  const stopServer = () => {
    if (serverRef.current) {
      try { serverRef.current.close(); } catch (_) {}
      serverRef.current = null;
      setServerRunning(false);
    }
  };

  const processMessage = useCallback((msg: P2PMessage, socketKey: string) => {
    if (msg.type === "ping") {
      const replySocket = socketsRef.current[msg.from] || inboundSocketsRef.current[socketKey];
      if (replySocket) {
        const pong: P2PMessage = { id: makeId(), type: "pong", from: "me", timestamp: Date.now() };
        try {
          replySocket.write(JSON.stringify(pong) + "\n");
        } catch (_) {}
      }
      setPeers((prev) =>
        prev.map((p) =>
          p.id === msg.from ? { ...p, status: "connected", lastSeen: Date.now() } : p
        )
      );
      return;
    }

    if (msg.type === "pong") {
      setPeers((prev) =>
        prev.map((p) =>
          p.id === msg.from ? { ...p, status: "connected", lastSeen: Date.now() } : p
        )
      );
      return;
    }

    if (msg.type === "text") {
      const chatMsg: ChatMessage = {
        id: msg.id,
        peerId: msg.from,
        direction: "in",
        type: "text",
        text: msg.text,
        timestamp: msg.timestamp,
        status: "received",
      };
      setMessages((prev) => ({
        ...prev,
        [msg.from]: [...(prev[msg.from] || []), chatMsg],
      }));
      return;
    }

    if (msg.type === "file") {
      const transfer: FileTransfer = {
        id: msg.id,
        peerId: msg.from,
        fileName: msg.fileName!,
        fileSize: msg.fileSize!,
        fileType: msg.fileType!,
        direction: "in",
        progress: 0,
        status: "transferring",
        chunks: [],
        totalChunks: msg.totalChunks!,
        receivedChunks: 0,
      };
      pendingTransfersRef.current[msg.id] = transfer;
      setTransfers((prev) => [...prev, transfer]);
      return;
    }

    if (msg.type === "file_chunk") {
      const t = pendingTransfersRef.current[msg.id];
      if (!t) return;
      t.chunks[msg.chunkIndex!] = msg.data!;
      t.receivedChunks += 1;
      t.progress = t.receivedChunks / t.totalChunks;
      setTransfers((prev) =>
        prev.map((x) => (x.id === msg.id ? { ...x, progress: t.progress, receivedChunks: t.receivedChunks } : x))
      );
      return;
    }

    if (msg.type === "file_end") {
      const t = pendingTransfersRef.current[msg.id];
      if (!t) return;
      const fileData = t.chunks.join("");
      t.status = "done";
      t.progress = 1;
      t.fileData = fileData;
      delete pendingTransfersRef.current[msg.id];
      setTransfers((prev) =>
        prev.map((x) => (x.id === msg.id ? { ...t, fileData } : x))
      );
      const chatMsg: ChatMessage = {
        id: makeId(),
        peerId: msg.from,
        direction: "in",
        type: "file",
        fileName: t.fileName,
        fileSize: t.fileSize,
        fileType: t.fileType,
        fileData,
        timestamp: msg.timestamp,
        status: "received",
      };
      setMessages((prev) => ({
        ...prev,
        [msg.from]: [...(prev[msg.from] || []), chatMsg],
      }));
    }
  }, []);

  const handleSocketData = useCallback(
    (data: Buffer | string, peerId: string, socketKey: string) => {
      const str = typeof data === "string" ? data : data.toString("utf8");
      bufferRef.current[peerId] = (bufferRef.current[peerId] || "") + str;
      const lines = bufferRef.current[peerId].split("\n");
      bufferRef.current[peerId] = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg: P2PMessage = JSON.parse(line);
          processMessage(msg, socketKey);
        } catch (_) {}
      }
    },
    [processMessage]
  );

  const startServer = useCallback(
    (port: number) => {
      if (serverRef.current) return;
      try {
        const server = TcpSocket.createServer((socket) => {
          const socketKey = `inbound_${Date.now()}`;
          inboundSocketsRef.current[socketKey] = socket as any;

          socket.on("data", (data) => {
            const str = typeof data === "string" ? data : (data as Buffer).toString("utf8");
            bufferRef.current[socketKey] = (bufferRef.current[socketKey] || "") + str;
            const lines = bufferRef.current[socketKey].split("\n");
            bufferRef.current[socketKey] = lines.pop() || "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const msg: P2PMessage = JSON.parse(line);
                if (msg.from) {
                  handleSocketData(data, msg.from, socketKey);
                  setPeers((prev) =>
                    prev.map((p) =>
                      p.id === msg.from
                        ? { ...p, status: "connected", lastSeen: Date.now() }
                        : p
                    )
                  );
                }
              } catch (_) {}
            }
          });

          socket.on("close", () => {
            delete inboundSocketsRef.current[socketKey];
          });

          socket.on("error", () => {
            delete inboundSocketsRef.current[socketKey];
          });
        });

        server.listen({ port, host: "0.0.0.0" }, () => {
          setServerRunning(true);
        });

        server.on("error", () => {
          setServerRunning(false);
          serverRef.current = null;
        });

        serverRef.current = server;
      } catch (_) {
        setServerRunning(false);
      }
    },
    [handleSocketData]
  );

  useEffect(() => {
    startServer(myPort);
  }, []);

  const addPeer = useCallback(
    (label: string, host: string, port: number) => {
      const id = makeId();
      const peer: Peer = { id, label, host, port, status: "offline" };
      setPeers((prev) => {
        const updated = [...prev, peer];
        savePeers(updated);
        return updated;
      });
    },
    [savePeers]
  );

  const removePeer = useCallback(
    (id: string) => {
      try {
        socketsRef.current[id]?.destroy();
        delete socketsRef.current[id];
      } catch (_) {}
      setPeers((prev) => {
        const updated = prev.filter((p) => p.id !== id);
        savePeers(updated);
        return updated;
      });
    },
    [savePeers]
  );

  const connectToPeer = useCallback(
    (peerId: string) => {
      const peer = peers.find((p) => p.id === peerId);
      if (!peer) return;

      if (socketsRef.current[peerId]) {
        try { socketsRef.current[peerId].destroy(); } catch (_) {}
        delete socketsRef.current[peerId];
      }

      setPeers((prev) =>
        prev.map((p) => (p.id === peerId ? { ...p, status: "connecting" } : p))
      );

      const isIPv6 = peer.host.includes(":");
      const options: any = {
        port: peer.port,
        host: peer.host,
        localAddress: "0.0.0.0",
        ...(isIPv6 ? { localPort: undefined } : {}),
      };

      try {
        const socket = TcpSocket.createConnection(options, () => {
          setPeers((prev) =>
            prev.map((p) =>
              p.id === peerId
                ? { ...p, status: "connected", lastSeen: Date.now() }
                : p
            )
          );
          const ping: P2PMessage = {
            id: makeId(),
            type: "ping",
            from: peerId + "_reply",
            timestamp: Date.now(),
          };
          try { socket.write(JSON.stringify(ping) + "\n"); } catch (_) {}
        });

        socket.on("data", (data) => handleSocketData(data, peerId, peerId));

        socket.on("error", () => {
          setPeers((prev) =>
            prev.map((p) => (p.id === peerId ? { ...p, status: "error" } : p))
          );
          delete socketsRef.current[peerId];
        });

        socket.on("close", () => {
          setPeers((prev) =>
            prev.map((p) =>
              p.id === peerId && p.status === "connected"
                ? { ...p, status: "offline" }
                : p
            )
          );
          delete socketsRef.current[peerId];
        });

        socketsRef.current[peerId] = socket;
      } catch (_) {
        setPeers((prev) =>
          prev.map((p) => (p.id === peerId ? { ...p, status: "error" } : p))
        );
      }
    },
    [peers, handleSocketData]
  );

  const disconnectPeer = useCallback((peerId: string) => {
    try {
      socketsRef.current[peerId]?.destroy();
      delete socketsRef.current[peerId];
    } catch (_) {}
    setPeers((prev) =>
      prev.map((p) => (p.id === peerId ? { ...p, status: "offline" } : p))
    );
  }, []);

  const getSocket = useCallback((peerId: string) => {
    return socketsRef.current[peerId] || null;
  }, []);

  const sendTextMessage = useCallback(
    (peerId: string, text: string) => {
      const socket = getSocket(peerId);
      if (!socket) return;
      const id = makeId();
      const msg: P2PMessage = {
        id,
        type: "text",
        from: "me",
        text,
        timestamp: Date.now(),
      };
      try {
        socket.write(JSON.stringify(msg) + "\n");
        const chatMsg: ChatMessage = {
          id,
          peerId,
          direction: "out",
          type: "text",
          text,
          timestamp: msg.timestamp,
          status: "sent",
        };
        setMessages((prev) => ({
          ...prev,
          [peerId]: [...(prev[peerId] || []), chatMsg],
        }));
      } catch (_) {}
    },
    [getSocket]
  );

  const sendFile = useCallback(
    (
      peerId: string,
      fileName: string,
      fileSize: number,
      fileType: string,
      fileData: string
    ) => {
      const socket = getSocket(peerId);
      if (!socket) return;

      const id = makeId();
      const totalChunks = Math.ceil(fileData.length / CHUNK_SIZE);

      const header: P2PMessage = {
        id,
        type: "file",
        from: "me",
        fileName,
        fileSize,
        fileType,
        totalChunks,
        timestamp: Date.now(),
      };

      const transfer: FileTransfer = {
        id,
        peerId,
        fileName,
        fileSize,
        fileType,
        direction: "out",
        progress: 0,
        status: "transferring",
        chunks: [],
        totalChunks,
        receivedChunks: 0,
      };
      setTransfers((prev) => [...prev, transfer]);

      try {
        socket.write(JSON.stringify(header) + "\n");

        let index = 0;
        const sendNextChunk = () => {
          if (index >= totalChunks) {
            const end: P2PMessage = {
              id,
              type: "file_end",
              from: "me",
              timestamp: Date.now(),
            };
            socket.write(JSON.stringify(end) + "\n");
            setTransfers((prev) =>
              prev.map((t) =>
                t.id === id ? { ...t, status: "done", progress: 1 } : t
              )
            );
            const chatMsg: ChatMessage = {
              id: makeId(),
              peerId,
              direction: "out",
              type: "file",
              fileName,
              fileSize,
              fileType,
              fileData,
              timestamp: Date.now(),
              status: "sent",
            };
            setMessages((prev) => ({
              ...prev,
              [peerId]: [...(prev[peerId] || []), chatMsg],
            }));
            return;
          }

          const chunk = fileData.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
          const chunkMsg: P2PMessage = {
            id,
            type: "file_chunk",
            from: "me",
            chunkIndex: index,
            totalChunks,
            data: chunk,
            timestamp: Date.now(),
          };
          socket.write(JSON.stringify(chunkMsg) + "\n");
          setTransfers((prev) =>
            prev.map((t) =>
              t.id === id
                ? { ...t, progress: (index + 1) / totalChunks }
                : t
            )
          );
          index++;
          setTimeout(sendNextChunk, 0);
        };

        sendNextChunk();
      } catch (_) {
        setTransfers((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: "error" } : t))
        );
      }
    },
    [getSocket]
  );

  return (
    <P2PContext.Provider
      value={{
        myPort,
        setMyPort,
        peers,
        addPeer,
        removePeer,
        connectToPeer,
        disconnectPeer,
        sendTextMessage,
        sendFile,
        messages,
        transfers,
        serverRunning,
      }}
    >
      {children}
    </P2PContext.Provider>
  );
}

export function useP2P() {
  const ctx = useContext(P2PContext);
  if (!ctx) throw new Error("useP2P must be used within P2PProvider");
  return ctx;
}
