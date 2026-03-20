import { useEffect } from "react";

// iOS gesture events have a scale property
interface GestureEvent extends Event {
  scale: number;
}

export const usePreventZoom = () => {
  useEffect(() => {
    // Detect if we're on a touch screen device
    // Exclude macOS with trackpad (MacIntel is desktop Mac, Mac ARM is also desktop)
    // Only allow iOS devices (iPhone, iPad, iPod) as touch screens
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isTouchScreen = isIOS || isAndroid;

    // macOS trackpad should never have touch listeners
    const isMacDesktop = /Macintosh|Mac OS X|MacIntel|MacARM|Mac_PowerPC/.test(navigator.userAgent) &&
                         !isIOS; // Exclude iOS devices

    console.log('Zoom prevention - Device detection:', {
      isIOS,
      isAndroid,
      isTouchScreen,
      isMacDesktop,
      userAgent: navigator.userAgent
    });

    // Dynamically set viewport meta tag for touch devices only
    if (isTouchScreen && !isMacDesktop) {
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      if (viewportMeta) {
        viewportMeta.setAttribute('content',
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
        );
      }
    }

    // Track initial touch positions to detect pinch vs scroll
    let initialTouches: { [id: number]: { x: number; y: number } } = {};

    // Only prevent specific zoom patterns, allow normal multi-touch
    const handleTouchStart = (e: TouchEvent) => {
      // Skip macOS trackpad entirely
      if (isMacDesktop) return;

      // Reset for tracking
      initialTouches = {};

      // Only track touch positions for potential zoom detection on touch screens
      if (isTouchScreen && e.touches.length === 2) {
        initialTouches = {
          [e.touches[0].identifier]: {
            x: e.touches[0].screenX,
            y: e.touches[0].screenY,
          },
          [e.touches[1].identifier]: {
            x: e.touches[1].screenX,
            y: e.touches[1].screenY,
          },
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Only check for pinch-zoom pattern on actual touch screens
      // Skip macOS trackpad completely
      if (!isTouchScreen || isMacDesktop) return;

      if (e.touches.length === 2 && Object.keys(initialTouches).length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        const initial1 = initialTouches[touch1.identifier];
        const initial2 = initialTouches[touch2.identifier];

        if (!initial1 || !initial2) return;

        // Calculate initial and current distances
        const initialDistance = Math.hypot(
          touch1.screenX - touch2.screenX,
          touch1.screenY - touch2.screenY
        );
        const currentDistance = Math.hypot(
          initial1.x - initial2.x,
          initial1.y - initial2.y
        );

        // Pinch zoom is when distance changes significantly (> 10px)
        // Scroll gestures keep distance roughly the same
        const distanceChange = Math.abs(initialDistance - currentDistance);

        if (distanceChange > 10) {
          e.preventDefault();
        }
      }
    };

    // Note: We removed handleTouchEnd double-tap prevention because it was
    // blocking legitimate click/tap events on list items and other interactive elements.
    // The viewport meta tag and gesture event prevention should be sufficient for
    // preventing zoom on mobile devices.

    // Prevent mouse wheel zoom on desktop (Ctrl/Cmd + scroll)
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    // Only add gesture listeners for iOS (specific API)
    if (isIOS) {
      const preventGestureZoom = (e: GestureEvent) => {
        if (e.scale !== undefined && e.scale !== 1) {
          e.preventDefault();
        }
      };
      document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
      document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
      document.addEventListener('gestureend', preventGestureZoom, { passive: false });
    }

    // Only add touch listeners on actual touch screen devices (not macOS trackpad)
    if (isTouchScreen && !isMacDesktop) {
      document.addEventListener('touchstart', handleTouchStart, { passive: false });
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    // Always add wheel listener for desktop zoom prevention
    document.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      if (isIOS) {
        const preventGestureZoom = (e: Event) => {
          if ((e as GestureEvent).scale !== undefined && (e as GestureEvent).scale !== 1) {
            e.preventDefault();
          }
        };
        document.removeEventListener('gesturestart', preventGestureZoom);
        document.removeEventListener('gesturechange', preventGestureZoom);
        document.removeEventListener('gestureend', preventGestureZoom);
      }
      if (isTouchScreen && !isMacDesktop) {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
      }
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);
};
