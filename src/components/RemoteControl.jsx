import React from "react";

const RemoteButton = ({ children, onClick, label, variant = "primary", disabled }) => {
  const baseStyles =
    "flex flex-col items-center justify-center gap-2 rounded-2xl px-4 py-5 transition-all duration-200 border text-sm font-semibold";
  const variants = {
    primary:
      "bg-gradient-to-br from-blue-600/80 to-purple-600/80 hover:from-blue-500/90 hover:to-purple-500/90 border-blue-400/40 shadow-lg shadow-blue-900/30",
    subtle:
      "bg-black/40 hover:bg-black/60 border-white/5 text-gray-200 shadow-inner shadow-black/40",
    danger:
      "bg-gradient-to-br from-red-600/80 to-pink-600/80 hover:from-red-500/90 hover:to-pink-500/90 border-red-400/40 shadow-lg shadow-red-900/30",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      {children}
      {label && <span className="uppercase tracking-wide text-xs text-white/80">{label}</span>}
    </button>
  );
};

const RemoteControl = ({
  visible,
  mode = "modal",
  onClose,
  headerContent,
  channel,
  hasNext = false,
  hasPrev = false,
  onNext,
  onPrev,
  playerState = {},
  onPlayPause,
  onStop,
  onMuteToggle,
  onVolumeUp,
  onVolumeDown,
  onVolumeChange,
  disabled = false,
  connectionStatus,
}) => {
  if (mode === "modal" && !visible) return null;

  const { isPlaying, volume = 1, isMuted } = playerState;
  const volumePercent = Math.round((isMuted ? 0 : volume) * 100);
  const controlsDisabled = disabled || !channel;
  const isModal = mode === "modal";

  return (
    <div
      className={
        isModal
          ? "fixed inset-0 z-50 bg-gradient-to-br from-gray-950/95 via-black/90 to-gray-900/95 backdrop-blur-xl flex items-center justify-center p-4"
          : "w-full flex justify-center px-4 pb-8"
      }
    >
      <div
        className={`relative w-full max-w-md bg-gradient-to-br from-gray-900 via-gray-900 to-black rounded-3xl border border-white/5 shadow-2xl shadow-black/80 p-6 space-y-6 ${
          isModal ? "" : "min-h-[28rem]"
        }`}
      >
        {isModal && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            aria-label="Close remote"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        )}

        {headerContent && <div>{headerContent}</div>}

        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/5 shadow-inner shadow-black/40">
            {channel?.logo ? (
              <img
                src={channel.logo}
                alt={channel.name}
                className="w-12 h-12 object-cover rounded-xl"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "";
                }}
              />
            ) : (
              <span className="text-white font-bold text-lg">TV</span>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-400 uppercase tracking-wider">Controlling</p>
            <h2 className="text-2xl font-semibold text-white">{channel?.name || "No channel selected"}</h2>
            {channel?.group && <p className="text-sm text-gray-400">{channel.group}</p>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <RemoteButton onClick={onPrev} disabled={!hasPrev || controlsDisabled} label="Prev">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 19l-7-7 7-7" />
            </svg>
          </RemoteButton>
          <RemoteButton onClick={onPlayPause} disabled={controlsDisabled} label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </RemoteButton>
          <RemoteButton onClick={onNext} disabled={!hasNext || controlsDisabled} label="Next">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5l7 7-7 7" />
            </svg>
          </RemoteButton>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <RemoteButton onClick={onStop} variant="danger" label="Stop" disabled={controlsDisabled}>
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
          </RemoteButton>
          <RemoteButton
            onClick={onMuteToggle}
            variant="subtle"
            label={isMuted ? "Unmute" : "Mute"}
            disabled={controlsDisabled}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMuted ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.6}
                  d="M9 9v6h3l5 5V4l-5 5H9zm7 3h2m-8-7l-4 4H3v4h3l4 4"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.6}
                  d="M11 5L6 9H3v6h3l5 4V5zm8-1a6 6 0 010 12m-3-9a3 3 0 010 6"
                />
              )}
            </svg>
          </RemoteButton>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-2xl p-5 space-y-4 shadow-inner shadow-black/50">
          <div className="flex items-center justify-between text-sm text-gray-300">
            <span>Volume</span>
            <span className="font-semibold">{controlsDisabled ? "--" : `${volumePercent}%`}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange?.(parseFloat(e.target.value))}
            className="w-full accent-blue-500 disabled:opacity-40"
            disabled={controlsDisabled}
          />
          <div className="grid grid-cols-2 gap-4">
            <RemoteButton onClick={onVolumeDown} variant="subtle" label="Vol -" disabled={controlsDisabled}>
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 12h14" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </RemoteButton>
            <RemoteButton onClick={onVolumeUp} variant="subtle" label="Vol +" disabled={controlsDisabled}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </RemoteButton>
          </div>
        </div>

        {connectionStatus && (
          <p className="text-center text-xs text-gray-500">{connectionStatus}</p>
        )}
      </div>
    </div>
  );
};

export default RemoteControl;

