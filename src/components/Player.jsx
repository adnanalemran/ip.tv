import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import Hls from "hls.js";

const Player = forwardRef(
({
    src,
    onBack,
    onNext,
    onPrev,
    channelName,
    hasNext,
    hasPrev,
    onPlayerStateChange,
  },
  ref
) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play().catch(() => {
          // Autoplay blocked
          setIsPlaying(false);
        });
      }
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
      if (!video.muted && video.volume === 0) {
        video.volume = 0.5;
        setVolume(0.5);
      }
    }
  }, []);

  const setVolumeLevel = useCallback((newVolume) => {
    const video = videoRef.current;
    if (video) {
      const clamped = Math.min(1, Math.max(0, newVolume));
      video.volume = clamped;
      setVolume(clamped);
      const muted = clamped === 0;
      setIsMuted(muted);
      video.muted = muted;
    }
  }, []);

  const handleVolumeChange = useCallback(
    (e) => {
      const newVolume = parseFloat(e.target.value);
      setVolumeLevel(newVolume);
    },
    [setVolumeLevel]
  );

  const changeVolumeBy = useCallback(
    (delta) => {
      setVolumeLevel((videoRef.current?.volume ?? volume) + delta);
    },
    [setVolumeLevel, volume]
  );

  const stopPlayback = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
      togglePlayPause,
      stop: stopPlayback,
      setVolume: setVolumeLevel,
      volumeUp: () => changeVolumeBy(0.1),
      volumeDown: () => changeVolumeBy(-0.1),
      toggleMute,
      getState: () => ({
        isPlaying,
        volume,
        isMuted,
      }),
    }),
    [
      togglePlayPause,
      stopPlayback,
      setVolumeLevel,
      changeVolumeBy,
      toggleMute,
      isPlaying,
      volume,
      isMuted,
    ]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      
      switch (e.key) {
        case "ArrowRight":
          if (hasNext && onNext) {
            e.preventDefault();
            onNext();
          }
          break;
        case "ArrowLeft":
          if (hasPrev && onPrev) {
            e.preventDefault();
            onPrev();
          }
          break;
        case " ":
          e.preventDefault();
          togglePlayPause();
          break;
        case "f":
        case "F":
          e.preventDefault();
          if (containerRef.current) {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              containerRef.current.requestFullscreen();
            }
          }
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [hasNext, hasPrev, onNext, onPrev, togglePlayPause, toggleMute]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setIsLoading(true);
    setError(null);
    let hls;

    const setupVideo = () => {
      if (Hls.isSupported()) {
        hls = new Hls({ 
          enableWorker: true,
          debug: false,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
        });
        
        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          video.play().catch(() => {
            // Autoplay blocked, user interaction required
            setIsPlaying(false);
            setIsLoading(false);
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                setError("Failed to load video");
                setIsLoading(false);
                break;
            }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.addEventListener("loadedmetadata", () => {
          setIsLoading(false);
          video.play().catch(() => {
            setIsPlaying(false);
            setIsLoading(false);
          });
        });
      } else {
        setError("HLS is not supported in this browser");
        setIsLoading(false);
      }
    };

    setupVideo();

    // Video event listeners
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => {
      setIsLoading(false);
      setDuration(video.duration || 0);
    };
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime || 0);
    };
    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      setVolume(video.volume ?? 1);
      setIsMuted(video.muted ?? false);
    };
    const handleVolumeChangeEvent = () => {
      if (video) {
        setVolume(video.volume);
        setIsMuted(video.muted || video.volume === 0);
      }
    };
    const handleError = () => {
      setError("Failed to load video");
      setIsLoading(false);
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("volumechange", handleVolumeChangeEvent);
    video.addEventListener("error", handleError);

    return () => {
      if (hls) {
        hls.destroy();
      }
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("volumechange", handleVolumeChangeEvent);
      video.removeEventListener("error", handleError);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls) {
      if (controlsTimeout) clearTimeout(controlsTimeout);
      const timeout = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
      setControlsTimeout(timeout);
    }
    return () => {
      if (controlsTimeout) clearTimeout(controlsTimeout);
    };
  }, [showControls, isPlaying]);

  const handleMouseMove = () => {
    setShowControls(true);
  };

  const handleContainerClick = (e) => {
    if (e.target === containerRef.current || e.target === videoRef.current) {
      togglePlayPause();
    }
  };

  const volumeValue = isMuted ? 0 : volume;

  const renderVolumeIcon = () => {
    if (isMuted || volumeValue === 0) {
      return (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 9v6h4l5 5V4l-5 5H9zm7 3h2m-8-7l-4 4H3v4h2l4 4V5z"
          />
        </svg>
      );
    }
    if (volumeValue < 0.4) {
      return (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5L6 9H3v6h3l5 4V5z"
          />
        </svg>
      );
    }
    if (volumeValue < 0.8) {
      return (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5L6 9H3v6h3l5 4V5zm8 3a4 4 0 010 8"
          />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 5L6 9H3v6h3l5 4V5zm8-1a6 6 0 010 12m-3-9a3 3 0 010 6"
        />
      </svg>
    );
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (onPlayerStateChange) {
      onPlayerStateChange({
        isPlaying,
        volume,
        isMuted,
      });
    }
  }, [isPlaying, volume, isMuted, onPlayerStateChange]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black flex flex-col overflow-hidden relative group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying) {
          setTimeout(() => setShowControls(false), 2000);
        }
      }}
      onClick={handleContainerClick}
    >
      {/* Back button for mobile */}
      {onBack && (
        <div className="md:hidden absolute top-4 left-4 z-30">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBack();
            }}
            className="px-4 py-2 bg-gradient-to-r from-gray-800/90 to-gray-900/90 backdrop-blur-md rounded-lg hover:from-gray-700/90 hover:to-gray-800/90 text-white text-sm font-medium transition-all duration-200 shadow-lg flex items-center gap-2 border border-gray-600/50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
        </div>
      )}

      {/* Channel name overlay */}
      {channelName && (
        <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-30 px-4 py-2 bg-black/70 backdrop-blur-md rounded-lg transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
          <p className="text-white text-sm font-medium">{channelName}</p>
        </div>
      )}

      {/* Video container */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black relative">
        {src ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              playsInline
              muted={false}
            />
            
            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-20">
                <div className="text-center">
                  <svg className="animate-spin h-12 w-12 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-white text-sm">Loading channel...</p>
                </div>
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20">
                <div className="text-center px-4">
                  <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-white text-lg font-medium mb-2">Error loading channel</p>
                  <p className="text-gray-400 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Custom Controls Overlay */}
            <div
              className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-20 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Center play/pause button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlayPause();
                  }}
                  className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 transition-all duration-200 flex items-center justify-center border-2 border-white/20 hover:border-white/40 group"
                >
                  {isPlaying ? (
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Navigation buttons */}
              <div className="absolute inset-y-0 left-0 flex items-center px-4">
                {hasPrev && onPrev && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPrev();
                    }}
                    className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 transition-all duration-200 flex items-center justify-center border-2 border-white/20 hover:border-white/40 group"
                    title="Previous Channel"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="absolute inset-y-0 right-0 flex items-center px-4">
                {hasNext && onNext && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNext();
                    }}
                    className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 transition-all duration-200 flex items-center justify-center border-2 border-white/20 hover:border-white/40 group"
                    title="Next Channel"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Bottom controls bar */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
                  {/* Play/Pause button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlayPause();
                    }}
                    className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 transition-all duration-200 flex items-center justify-center"
                  >
                    {isPlaying ? (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  {/* Volume */}
                  <div
                    className="relative flex items-center gap-2"
                    onMouseEnter={() => setShowVolumeSlider(true)}
                    onMouseLeave={() => setShowVolumeSlider(false)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                      }}
                      className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 transition-all duration-200 flex items-center justify-center"
                      title={isMuted ? "Unmute" : "Mute"}
                    >
                      {renderVolumeIcon()}
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-200 origin-left ${
                        showVolumeSlider ? "w-28 opacity-100" : "w-0 opacity-0"
                      }`}
                    >
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volumeValue}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleVolumeChange(e);
                        }}
                        className="w-full accent-blue-500"
                      />
                    </div>
                  </div>

                  {/* Time display */}
                  <div className="flex-1 text-white text-sm font-medium">
                    <span>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  {/* Fullscreen button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (containerRef.current) {
                        if (document.fullscreenElement) {
                          document.exitFullscreen();
                        } else {
                          containerRef.current.requestFullscreen();
                        }
                      }
                    }}
                    className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 transition-all duration-200 flex items-center justify-center"
                    title="Fullscreen"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-400 text-base font-medium">Select a channel to start</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default Player;
