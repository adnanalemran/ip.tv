import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Peer from "peerjs";
import RemoteControl from "../components/RemoteControl";

const RemotePage = () => {
  const { sessionId: paramSessionId } = useParams();
  const navigate = useNavigate();
  const [clientId, setClientId] = useState("");
  const [targetSession, setTargetSession] = useState(paramSessionId || "");
  const [connectionStatus, setConnectionStatus] = useState("initializing");
  const [hostState, setHostState] = useState({
    channel: null,
    player: { isPlaying: false, volume: 1, isMuted: false },
    nav: { hasNext: false, hasPrev: false },
  });

  const peerRef = useRef(null);
  const connectionRef = useRef(null);

  const destroyConnection = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
  }, []);

const connectToSession = useCallback(
    (sessionId) => {
      if (!peerRef.current || !sessionId) return;

      destroyConnection();
      setConnectionStatus("connecting");

      const conn = peerRef.current.connect(sessionId.trim());
      connectionRef.current = conn;

      conn.on("open", () => {
        setConnectionStatus("connected");
        conn.send({ type: "remote-ready" });
        if (paramSessionId !== sessionId) {
          navigate(`/remote/${sessionId}`, { replace: true });
        }
      });

      conn.on("data", (message) => {
        if (message?.type === "state") {
          setHostState(message.payload);
        }
      });

      conn.on("close", () => {
        if (connectionRef.current === conn) {
          connectionRef.current = null;
        }
        setConnectionStatus("disconnected");
        setHostState((prev) => ({
          ...prev,
          channel: null,
          nav: { hasNext: false, hasPrev: false },
        }));
      });

      conn.on("error", () => {
        if (connectionRef.current === conn) {
          connectionRef.current = null;
        }
        setConnectionStatus("error");
      });
  },
  [navigate, paramSessionId, destroyConnection]
);

useEffect(() => {
  const peer = new Peer(undefined, { debug: 0 });
  peerRef.current = peer;

  peer.on("open", (id) => {
    setClientId(id);
    setConnectionStatus("idle");
    if (paramSessionId) {
      connectToSession(paramSessionId);
    }
  });

  peer.on("error", () => {
    setConnectionStatus("error");
  });

  return () => {
    destroyConnection();
    peer.destroy();
  };
}, [connectToSession, destroyConnection, paramSessionId]);

  const sendCommand = useCallback((command, payload) => {
    if (!connectionRef.current || !connectionRef.current.open) return;
    connectionRef.current.send({ type: "command", command, payload });
  }, []);

  const connectionInfo = useMemo(() => {
    switch (connectionStatus) {
      case "initializing":
        return "Initializing...";
      case "idle":
        return "Enter a session code to connect";
      case "connecting":
        return "Connecting to host...";
      case "connected":
        return "Connected to host";
      case "disconnected":
        return "Connection lost. Retry.";
      case "error":
        return "Connection error. Please retry.";
      default:
        return "";
    }
  }, [connectionStatus]);

  const isConnected = connectionStatus === "connected";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 text-white flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-md mb-6 text-center">
        <h1 className="text-3xl font-bold mb-2">IPTV Remote</h1>
        <p className="text-gray-400 text-sm">
          Control a TV session remotely. Ask the host for the session code displayed in the app.
        </p>
      </div>

      <div className="w-full max-w-md bg-black/40 border border-white/5 rounded-3xl p-5 mb-6 shadow-2xl shadow-black/60 space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-2">Remote session code</label>
          <input
            value={targetSession}
            onChange={(e) => setTargetSession(e.target.value.toUpperCase())}
            placeholder="e.g. AB12CD"
            className="w-full px-4 py-3 rounded-2xl bg-gray-900/80 border border-gray-700/60 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/60 placeholder-gray-500 tracking-widest text-center uppercase"
          />
        </div>
        <button
          onClick={() => connectToSession(targetSession)}
          disabled={!targetSession || connectionStatus === "connecting"}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-blue-900/40 font-semibold tracking-wide"
        >
          {connectionStatus === "connecting" ? "Connecting..." : "Connect"}
        </button>
        <p className="text-sm text-gray-400 text-center">{connectionInfo}</p>
        {clientId && (
          <p className="text-xs text-gray-500 text-center">
            Your remote ID: <span className="font-mono text-gray-300">{clientId}</span>
          </p>
        )}
      </div>

      <RemoteControl
        mode="page"
        visible
        channel={hostState.channel}
        hasNext={hostState.nav.hasNext}
        hasPrev={hostState.nav.hasPrev}
        playerState={hostState.player}
        onNext={() => sendCommand("next")}
        onPrev={() => sendCommand("prev")}
        onPlayPause={() => sendCommand("toggle-play")}
        onStop={() => sendCommand("stop")}
        onMuteToggle={() => sendCommand("toggle-mute")}
        onVolumeUp={() => sendCommand("volume-up")}
        onVolumeDown={() => sendCommand("volume-down")}
        onVolumeChange={(value) => sendCommand("set-volume", { value })}
        disabled={!isConnected}
        connectionStatus={connectionStatus}
      />
    </div>
  );
};

export default RemotePage;

