import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useDeferredValue,
  memo,
} from "react";
import Player from "./Player";
import RemoteControl from "./RemoteControl";
import Peer from "peerjs";
import { QRCodeCanvas } from "qrcode.react";
const parseM3U = (text) => {
  const lines = text.split("\n");
  const channels = [];
  let current = {};
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      const name = line.split(",")[1] || "Unknown";
      const logoMatch = line.match(/tvg-logo="(.*?)"/i);
      const groupMatch = line.match(/group-title="(.*?)"/i);
      current = {
        name: name.trim(),
        logo: logoMatch ? logoMatch[1] : null,
        group: groupMatch ? groupMatch[1] : "Other",
      };
    } else if (!line.startsWith("#")) {
      current.url = line;
      channels.push(current);
      current = {};
    }
  }
  return channels;
};
 
const generateSessionId = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const REMOTE_SESSION_STORAGE_KEY = "iptv-remote-session-id";


function App() {
  const playlistURL =
    "https://raw.githubusercontent.com/bugsfreeweb/LiveTVCollector/refs/heads/main/LiveTV/Bangladesh/LiveTV.m3u";

  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const deferredCategory = useDeferredValue(selectedCategory);

  // mobile state
  const [showPlayerOnMobile, setShowPlayerOnMobile] = useState(false);
  const [showRemote, setShowRemote] = useState(false);
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    volume: 1,
    isMuted: false,
  });
  const [remoteSessionId, setRemoteSessionId] = useState(
    () => localStorage.getItem(REMOTE_SESSION_STORAGE_KEY) || ""
  );
  const [remoteHostStatus, setRemoteHostStatus] = useState("inactive");
  const [remoteConnectedClients, setRemoteConnectedClients] = useState(0);
  const [remoteError, setRemoteError] = useState(null);
  const playerRef = useRef(null);
  const remotePeerRef = useRef(null);
  const remoteConnectionsRef = useRef([]);

  useEffect(() => {
    const saved = localStorage.getItem("sharedChannels");
    if (saved) {
      const parsed = JSON.parse(saved);
      setChannels(parsed);
      if (parsed.length > 0) setSelectedChannel(parsed[0]);
    } else {
      fetchPlaylist();
    }
  }, []);

  const fetchPlaylist = async () => {
    try {
      setLoading(true);
      const response = await fetch(playlistURL);
      const text = await response.text();
      const parsedChannels = parseM3U(text);
      setChannels(parsedChannels);
      if (parsedChannels.length > 0) setSelectedChannel(parsedChannels[0]);
      localStorage.setItem("sharedChannels", JSON.stringify(parsedChannels));
    } catch (err) {
      console.error("Failed to fetch playlist:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    localStorage.removeItem("sharedChannels");
    fetchPlaylist();
  };

  const categories = useMemo(() => {
    const groups = new Set(channels.map((ch) => ch.group || "Other"));
    return ["All", ...groups];
  }, [channels]);

  const filteredChannels = useMemo(() => {
    const search = deferredSearchTerm.toLowerCase();
    const category = deferredCategory;
    return channels.filter((ch) => {
      const matchesName = ch.name.toLowerCase().includes(search);
      const matchesCategory = category === "All" || ch.group === category;
      return matchesName && matchesCategory;
    });
  }, [channels, deferredSearchTerm, deferredCategory]);


  const handleSelectChannel = async (ch) => {
    setSelectedChannel(ch);
    // mobile only
    if (window.innerWidth < 1040) {
      setShowPlayerOnMobile(true);
    }
  };

  const getCurrentChannelIndex = useCallback(() => {
    return filteredChannels.findIndex((ch) => ch.url === selectedChannel?.url);
  }, [filteredChannels, selectedChannel]);

  const hasNextChannel = useCallback(() => {
    const currentIndex = getCurrentChannelIndex();
    return currentIndex >= 0 && currentIndex < filteredChannels.length - 1;
  }, [filteredChannels, getCurrentChannelIndex]);

  const hasPrevChannel = useCallback(() => {
    const currentIndex = getCurrentChannelIndex();
    return currentIndex > 0;
  }, [getCurrentChannelIndex]);

  const handleNextChannel = useCallback(() => {
    if (filteredChannels.length === 0) return;
    const currentIndex = getCurrentChannelIndex();
    if (currentIndex >= 0 && currentIndex < filteredChannels.length - 1) {
      setSelectedChannel(filteredChannels[currentIndex + 1]);
    }
  }, [filteredChannels, getCurrentChannelIndex]);

  const handlePrevChannel = useCallback(() => {
    if (filteredChannels.length === 0) return;
    const currentIndex = getCurrentChannelIndex();
    if (currentIndex > 0) {
      setSelectedChannel(filteredChannels[currentIndex - 1]);
    }
  }, [filteredChannels, getCurrentChannelIndex]);

  const remotePlayPause = useCallback(() => {
    playerRef.current?.togglePlayPause();
  }, []);

  const remoteStop = useCallback(() => {
    playerRef.current?.stop();
  }, []);

  const remoteMuteToggle = useCallback(() => {
    playerRef.current?.toggleMute();
  }, []);

  const remoteVolumeUp = useCallback(() => {
    playerRef.current?.volumeUp();
  }, []);

  const remoteVolumeDown = useCallback(() => {
    playerRef.current?.volumeDown();
  }, []);

  const remoteVolumeChange = useCallback((value) => {
    playerRef.current?.setVolume(value);
  }, []);

  const handleRemoteCommand = useCallback(
    (command, payload) => {
      switch (command) {
        case "next":
          handleNextChannel();
          break;
        case "prev":
          handlePrevChannel();
          break;
        case "toggle-play":
          remotePlayPause();
          break;
        case "stop":
          remoteStop();
          break;
        case "toggle-mute":
          remoteMuteToggle();
          break;
        case "volume-up":
          remoteVolumeUp();
          break;
        case "volume-down":
          remoteVolumeDown();
          break;
        case "set-volume":
          if (typeof payload?.value === "number") {
            remoteVolumeChange(payload.value);
          }
          break;
        default:
          break;
      }
    },
    [
      handleNextChannel,
      handlePrevChannel,
      remotePlayPause,
      remoteStop,
      remoteMuteToggle,
      remoteVolumeUp,
      remoteVolumeDown,
      remoteVolumeChange,
    ]
  );

  const sendStateToConnection = useCallback(
    (conn) => {
      if (!conn?.open) return;
      conn.send({
        type: "state",
        payload: {
          channel: selectedChannel,
          player: playerState,
          nav: {
            hasNext: hasNextChannel(),
            hasPrev: hasPrevChannel(),
          },
        },
      });
    },
    [selectedChannel, playerState, hasNextChannel, hasPrevChannel]
  );

  const broadcastRemoteState = useCallback(() => {
    if (remoteConnectionsRef.current.length === 0) return;
    remoteConnectionsRef.current.forEach((conn) => sendStateToConnection(conn));
  }, [sendStateToConnection]);

  const stopRemoteHost = useCallback((nextStatus = "inactive") => {
    remoteConnectionsRef.current.forEach((conn) => conn.close());
    remoteConnectionsRef.current = [];
    setRemoteConnectedClients(0);
    if (remotePeerRef.current) {
      remotePeerRef.current.destroy();
      remotePeerRef.current = null;
    }
    setRemoteHostStatus(nextStatus);
  }, []);

  const startRemoteHost = useCallback(() => {
    if (remotePeerRef.current) {
      setRemoteHostStatus("ready");
      return;
    }

    const id = remoteSessionId || generateSessionId();
    setRemoteSessionId(id);
    localStorage.setItem(REMOTE_SESSION_STORAGE_KEY, id);
    setRemoteHostStatus("connecting");
    setRemoteError(null);

    const peer = new Peer(id, { debug: 0 });
    remotePeerRef.current = peer;

    peer.on("open", () => {
      setRemoteHostStatus("ready");
    });

    peer.on("connection", (conn) => {
      remoteConnectionsRef.current.push(conn);
      setRemoteConnectedClients(remoteConnectionsRef.current.length);

      conn.on("data", (message) => {
        if (message?.type === "command") {
          handleRemoteCommand(message.command, message.payload);
        } else if (message?.type === "remote-ready") {
          sendStateToConnection(conn);
        }
      });

      const cleanupConnection = () => {
        remoteConnectionsRef.current = remoteConnectionsRef.current.filter((c) => c !== conn);
        setRemoteConnectedClients(remoteConnectionsRef.current.length);
      };

      conn.on("close", cleanupConnection);
      conn.on("error", () => {
        cleanupConnection();
      });

      sendStateToConnection(conn);
    });

    peer.on("error", (err) => {
      setRemoteError(err?.message || "Unable to start remote session");
      stopRemoteHost("error");
    });
  }, [remoteSessionId, handleRemoteCommand, sendStateToConnection, stopRemoteHost]);

  useEffect(() => {
    return () => {
      stopRemoteHost();
    };
  }, [stopRemoteHost]);

  useEffect(() => {
    broadcastRemoteState();
  }, [broadcastRemoteState, selectedChannel, playerState]);

  useEffect(() => {
    if (showRemote && remoteHostStatus === "inactive") {
      startRemoteHost();
    }
  }, [showRemote, remoteHostStatus, startRemoteHost]);

  const remoteShareLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return remoteSessionId
      ? `${window.location.origin}/remote/${remoteSessionId}`
      : `${window.location.origin}/remote`;
  }, [remoteSessionId]);

  const remoteHostStatusMessage = useMemo(() => {
    switch (remoteHostStatus) {
      case "connecting":
        return "Starting remote session...";
      case "ready":
        return remoteConnectedClients > 0
          ? `${remoteConnectedClients} remote device${remoteConnectedClients > 1 ? "s" : ""} connected`
          : "Waiting for remote device...";
      case "error":
        return remoteError || "Remote session error";
      case "inactive":
      default:
        return "Remote session disabled";
    }
  }, [remoteHostStatus, remoteConnectedClients, remoteError]);

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white overflow-hidden">
      {/* Desktop / Tablet layout */}
      <div className="hidden md:flex h-full">
        {/* Sidebar */}
        <div className="w-72 bg-gradient-to-b from-gray-800 to-gray-900 flex flex-col shadow-2xl border-r border-gray-700/50">
          {/* Header */}
          <div className="p-5 border-b border-gray-700/50 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">TV</span>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  IPTV Player
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg text-sm font-medium text-white transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </>
                )}
              </button>
              <button
                onClick={() => setShowRemote(true)}
                disabled={!selectedChannel}
                className="w-full px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 rounded-lg text-sm font-medium text-white transition-all duration-200 shadow-lg hover:shadow-xl border border-gray-700/70 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4h8l2 4h-4l3 8H7l3-8H6l2-4z" />
                </svg>
                Remote
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-gray-700/50">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search channels..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-gray-700/50 backdrop-blur-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-gray-700/70 transition-all duration-200 border border-gray-600/50"
              />
            </div>
          </div>

          {/* Category */}
          <div className="px-4 pb-4 border-b border-gray-700/50">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-xl bg-gray-700/50 backdrop-blur-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-gray-700/70 transition-all duration-200 border border-gray-600/50 cursor-pointer"
            >
              {categories?.map((cat, idx) => (
                <option key={idx} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Channel List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-8">
                <svg className="animate-spin h-8 w-8 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-400">Loading channels...</p>
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-400 font-medium">No channels found</p>
                <p className="text-gray-500 text-sm mt-1">Try adjusting your search or filter</p>
              </div>
            ) : (
              <div className="p-2">
                {filteredChannels.map((ch) => (
                  <ChannelCard
                    key={ch.url}
                    channel={ch}
                    isSelected={selectedChannel?.url === ch.url}
                    onSelect={handleSelectChannel}
                    idleClass="hover:bg-gray-700/50 border border-transparent hover:border-gray-600/50"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Player */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-gray-900 to-black">
          <div className="p-6 bg-gradient-to-r from-gray-800/80 to-gray-900/80 backdrop-blur-sm border-b border-gray-700/50 shadow-lg">
            <div className="flex items-center gap-3">
              {selectedChannel?.logo && (
                <img
                  src={selectedChannel.logo}
                  alt={selectedChannel.name}
                  className="w-10 h-10 rounded-lg object-cover shadow-md"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "";
                  }}
                />
              )}
              <div>
                <h1 className="text-xl font-bold truncate bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  {selectedChannel?.name || "Select a channel"}
                </h1>
                {selectedChannel?.group && (
                  <p className="text-sm text-gray-400 mt-0.5">{selectedChannel.group}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-black/50">
            {selectedChannel ? (
              <Player
                ref={playerRef}
                src={selectedChannel?.url}
                channelName={selectedChannel?.name}
                onNext={handleNextChannel}
                onPrev={handlePrevChannel}
                hasNext={hasNextChannel()}
                hasPrev={hasPrevChannel()}
                onPlayerStateChange={setPlayerState}
              />
            ) : (
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-400 text-lg font-medium">Select a channel to start watching</p>
                <p className="text-gray-500 text-sm mt-2">Choose from the sidebar to begin</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden h-full">
        {showPlayerOnMobile ? (
          <Player
            ref={playerRef}
            src={selectedChannel?.url}
            channelName={selectedChannel?.name}
            onBack={() => { setShowPlayerOnMobile(false); }}
            onNext={handleNextChannel}
            onPrev={handlePrevChannel}
            hasNext={hasNextChannel()}
            hasPrev={hasPrevChannel()}
            onPlayerStateChange={setPlayerState}
          />
        ) : (
          <div className="flex flex-col h-full bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
            {/* Mobile Header */}
            <div className="p-4 border-b border-gray-700/50 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">TV</span>
                  </div>
                  <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    IPTV Player
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg text-xs font-medium text-white transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {loading ? (
                      <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setShowRemote(true)}
                    disabled={!selectedChannel}
                    className="px-3 py-1.5 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 rounded-lg text-xs font-medium text-white transition-all duration-200 shadow-md border border-gray-700/70 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4h8l2 4h-4l3 8H7l3-8H6l2-4z" />
                    </svg>
                    Remote
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Search */}
            <div className="p-3 border-b border-gray-700/50 bg-gray-800/50">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-gray-700/50 backdrop-blur-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-gray-700/70 transition-all duration-200 border border-gray-600/50"
                />
              </div>
            </div>

            {/* Mobile Category */}
            <div className="px-3 pb-3 border-b border-gray-700/50 bg-gray-800/50">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl bg-gray-700/50 backdrop-blur-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-gray-700/70 transition-all duration-200 border border-gray-600/50 cursor-pointer"
              >
                {categories?.map((cat, idx) => (
                  <option key={idx} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Mobile Channel List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <svg className="animate-spin h-8 w-8 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-gray-400">Loading channels...</p>
                </div>
              ) : filteredChannels.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-400 font-medium">No channels found</p>
                  <p className="text-gray-500 text-sm mt-1">Try adjusting your search or filter</p>
                </div>
              ) : (
                <div className="p-2">
                  {filteredChannels.map((ch) => (
                    <ChannelCard
                      key={ch.url}
                      channel={ch}
                      isSelected={selectedChannel?.url === ch.url}
                      onSelect={handleSelectChannel}
                      idleClass="hover:bg-gray-700/50 border border-transparent active:bg-gray-700/70"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {selectedChannel && (
        <RemoteControl
          visible={showRemote}
          onClose={() => setShowRemote(false)}
          channel={selectedChannel}
          hasNext={hasNextChannel()}
          hasPrev={hasPrevChannel()}
          onNext={handleNextChannel}
          onPrev={handlePrevChannel}
          playerState={playerState}
          onPlayPause={remotePlayPause}
          onStop={remoteStop}
          onMuteToggle={remoteMuteToggle}
          onVolumeUp={remoteVolumeUp}
          onVolumeDown={remoteVolumeDown}
          onVolumeChange={remoteVolumeChange}
          headerContent={
            <RemoteSessionCard
              status={remoteHostStatus}
              sessionId={remoteSessionId}
              connected={remoteConnectedClients}
              shareLink={remoteShareLink}
              onStart={startRemoteHost}
              onStop={() => stopRemoteHost("inactive")}
              error={remoteError}
            />
          }
          connectionStatus={remoteHostStatusMessage}
        />
      )}
    </div>
  );
}

export default App;

const RemoteSessionCard = ({ status, sessionId, connected, shareLink, onStart, onStop, error }) => {
  const [copied, setCopied] = useState(false);

  const statusStyles = {
    inactive: "bg-gray-700/60 text-gray-200",
    connecting: "bg-yellow-600/30 text-yellow-300",
    ready: "bg-green-600/30 text-green-200",
    error: "bg-red-600/30 text-red-200",
  };

  const statusLabels = {
    inactive: "Not Started",
    connecting: "Starting",
    ready: "Live",
    error: "Error",
  };

  const handleCopy = async () => {
    if (!shareLink || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Clipboard copy failed", err);
    }
  };

  const canStart = status === "inactive" || status === "error";
  const canStop = status === "ready" || status === "connecting";

  return (
    <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-[0.3em]">Remote Session</p>
          <p className="text-lg font-semibold text-white">{sessionId || "Not started"}</p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full ${statusStyles[status] || statusStyles.inactive}`}>
          {statusLabels[status] || statusLabels.inactive}
        </span>
      </div>
      <p className="text-xs text-gray-400">
        Share this link on another device to open the dedicated remote page.
      </p>
      <div className="bg-black/60 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 break-all">
        {shareLink || "Start the session to generate a share link"}
      </div>
      {shareLink && (
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="p-3 bg-white rounded-2xl shadow-inner shadow-black/40">
            <QRCodeCanvas value={shareLink} size={140} bgColor="#ffffff" fgColor="#111827" level="H" />
          </div>
          <p className="text-xs text-gray-400 text-center">Scan this QR code from another device to open the remote.</p>
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Connected devices</span>
        <span className="text-white font-semibold">{connected}</span>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {canStart && (
          <button
            onClick={onStart}
            className="flex-1 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-sm font-semibold shadow-md shadow-blue-900/50"
          >
            Start session
          </button>
        )}
        {canStop && (
          <button
            onClick={onStop}
            className="flex-1 px-3 py-2 rounded-xl bg-gray-800 text-sm font-semibold border border-white/10"
          >
            Stop session
          </button>
        )}
        <button
          onClick={handleCopy}
          disabled={!shareLink}
          className="flex-1 px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
};

const ChannelCard = memo(({ channel, isSelected, onSelect, idleClass }) => {
  return (
    <div
      onClick={() => onSelect(channel)}
      className={`group flex items-center gap-3 px-4 py-3 mb-2 cursor-pointer rounded-xl transition-all duration-200 ${
        isSelected
          ? "bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-blue-500/50 shadow-lg"
          : idleClass
      }`}
    >
      {channel.logo ? (
        <div className="relative flex-shrink-0">
          <img
            src={channel.logo}
            alt={channel.name}
            loading="lazy"
            className="w-12 h-12 rounded-lg object-cover shadow-md group-hover:shadow-lg transition-shadow duration-200"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "";
            }}
          />
          {isSelected && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
          )}
        </div>
      ) : (
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center text-xs font-bold shadow-md transition-all duration-200 ${
            isSelected
              ? "bg-gradient-to-br from-blue-500 to-purple-600"
              : "bg-gradient-to-br from-gray-600 to-gray-700 group-hover:from-gray-500 group-hover:to-gray-600"
          }`}
        >
          TV
        </div>
      )}
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-sm font-semibold truncate text-white group-hover:text-blue-300 transition-colors duration-200">
          {channel.name}
        </span>
        {channel.group && (
          <span className="text-xs text-gray-400 truncate mt-0.5">{channel.group}</span>
        )}
      </div>
      {isSelected && (
        <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </div>
  );
});
