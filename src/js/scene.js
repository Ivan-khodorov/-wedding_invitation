const READY_CLASS = "is-ready";
const NAMES_VISIBLE_CLASS = "is-names-visible";
const PHOTO_VISIBLE_CLASS = "is-photo-visible";
const INTRO_HEIGHT_LIMIT_CLASS = "is-intro-height-limited";
const DESKTOP_BLOCK_CLASS = "is-desktop-blocked";
const INTRO_HEIGHT_LIMIT_MS = 5000;
const MOBILE_ONLY_MAX_WIDTH_PX = 525;
const INTRO_SCROLL_NUDGE_PX = 300;
const INTRO_SCROLL_NUDGE_DURATION_MS = 900;
const INTRO_SCROLL_NUDGE_DELAY_MS = 400;
const MOBILE_ONLY_NOTICE_MARKER = "data-mobile-only-notice";
const SCENE_BOOTSTRAP_PENDING_CLASS = "is-bootstrap-pending";
const ASSET_PRELOAD_TIMEOUT_MS = 12000;
const VIDEO_PRELOAD_READY_STATE = 3;
const TYPING_TEXT_SELECTOR = "[data-typing-text]";
const TYPING_VISIBLE_CLASS = "is-visible";
const TYPING_ACTIVE_CLASS = "is-typing";
const TYPING_START_DELAY_MS = 2000;
const TYPING_STEP_MS = 52;
const TYPING_BETWEEN_LINES_MS = 140;
const PLACE_SELECTOR = ".place";
const PLACE_ARROW_SVG_SELECTOR = "[data-place-arrow-svg]";
const PLACE_ARROW_PATH_SELECTOR = "[data-place-arrow-path]";
const PLACE_WEDDING_IMAGE_SELECTOR = ".place__wedding .place__image";
const PLACE_MEETING_IMAGE_SELECTOR = ".place__meeting .place__image";
const PLACE_IMAGE_TAG_SELECTOR = "img";
const PLACE_ANCHOR_OFFSET_PX = 15;
const PLACE_TOP_POINT_SHIFT_X_PX = -8;
const PLACE_BOTTOM_POINT_SHIFT_X_PX = 12;
const PLACE_TOP_POINT_SHIFT_Y_PX = -15;
const PLACE_BOTTOM_POINT_SHIFT_Y_PX = 15;

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isMobileViewportWidth() {
  return window.innerWidth <= MOBILE_ONLY_MAX_WIDTH_PX;
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve) => {
    let isSettled = false;

    const timerId = window.setTimeout(() => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      resolve();
    }, timeoutMs);

    promise
      .catch(() => {
        // Asset preload errors should not block the scene forever.
      })
      .then(() => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        window.clearTimeout(timerId);
        resolve();
      });
  });
}

function waitForFontFaces() {
  if (!document.fonts || !document.fonts.ready) {
    return Promise.resolve();
  }

  return withTimeout(document.fonts.ready, ASSET_PRELOAD_TIMEOUT_MS);
}

function waitForImageElement(imageElement) {
  if (imageElement.complete && imageElement.naturalWidth > 0) {
    if (typeof imageElement.decode === "function") {
      return imageElement.decode().catch(() => {});
    }

    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const handleDone = () => {
      imageElement.removeEventListener("load", handleDone);
      imageElement.removeEventListener("error", handleDone);
      resolve();
    };

    imageElement.addEventListener("load", handleDone);
    imageElement.addEventListener("error", handleDone);
  });
}

function waitForSceneImages(sceneRoot) {
  const imageElements = Array.from(sceneRoot.querySelectorAll("img"));

  if (!imageElements.length) {
    return Promise.resolve();
  }

  return withTimeout(Promise.all(imageElements.map(waitForImageElement)), ASSET_PRELOAD_TIMEOUT_MS);
}

function waitForHeroVideo(videoElement) {
  if (!videoElement) {
    return Promise.resolve();
  }

  if (videoElement.readyState >= VIDEO_PRELOAD_READY_STATE) {
    return Promise.resolve();
  }

  videoElement.preload = "auto";

  try {
    videoElement.load();
  } catch (error) {
    // Some browsers can reject load calls under specific states; continue with fallback listeners.
  }

  const videoReadyPromise = new Promise((resolve) => {
    const handleReady = () => {
      videoElement.removeEventListener("canplay", handleReady);
      videoElement.removeEventListener("canplaythrough", handleReady);
      videoElement.removeEventListener("loadeddata", handleReady);
      videoElement.removeEventListener("error", handleReady);
      resolve();
    };

    videoElement.addEventListener("canplay", handleReady, { once: true });
    videoElement.addEventListener("canplaythrough", handleReady, { once: true });
    videoElement.addEventListener("loadeddata", handleReady, { once: true });
    videoElement.addEventListener("error", handleReady, { once: true });
  });

  return withTimeout(videoReadyPromise, ASSET_PRELOAD_TIMEOUT_MS);
}

function preloadSceneAssets(sceneRoot, videoElement) {
  return Promise.all([
    waitForSceneImages(sceneRoot),
    waitForFontFaces(),
    waitForHeroVideo(videoElement)
  ]);
}

function getTypingLines(sceneRoot) {
  return Array.from(sceneRoot.querySelectorAll(TYPING_TEXT_SELECTOR));
}

function prepareTypingLines(sceneRoot) {
  const typingLines = getTypingLines(sceneRoot);

  typingLines.forEach((lineElement) => {
    const fullText = lineElement.dataset.typingText || lineElement.textContent || "";
    lineElement.dataset.typingText = fullText;
    lineElement.textContent = "";
    lineElement.classList.remove(TYPING_VISIBLE_CLASS);
    lineElement.classList.remove(TYPING_ACTIVE_CLASS);
  });
}

async function playTypingAnimation(sceneRoot) {
  const typingLines = getTypingLines(sceneRoot);

  if (!typingLines.length) {
    return;
  }

  for (let lineIndex = 0; lineIndex < typingLines.length; lineIndex += 1) {
    const lineElement = typingLines[lineIndex];
    const fullText = lineElement.dataset.typingText || "";

    lineElement.textContent = "";
    lineElement.classList.add(TYPING_VISIBLE_CLASS);
    lineElement.classList.add(TYPING_ACTIVE_CLASS);

    for (let charIndex = 1; charIndex <= fullText.length; charIndex += 1) {
      lineElement.textContent = fullText.slice(0, charIndex);
      await wait(TYPING_STEP_MS);
    }

    lineElement.classList.remove(TYPING_ACTIVE_CLASS);

    if (lineIndex < typingLines.length - 1) {
      await wait(TYPING_BETWEEN_LINES_MS);
    }
  }
}

function freezeLastVideoFrame(videoElement) {
  try {
    const duration = videoElement.duration;

    if (Number.isFinite(duration) && duration > 0.06) {
      videoElement.currentTime = duration - 0.06;
    }
  } catch (error) {
    // Some browsers can disallow seek at video end; paused state still keeps frame.
  }

  videoElement.pause();
}

function nudgeScrollAvailability() {
  const scrollingElement = document.scrollingElement || document.documentElement;
  const currentScrollTop = scrollingElement.scrollTop;
  const maxScrollTop = Math.max(0, scrollingElement.scrollHeight - window.innerHeight);
  const nudgeDistance = Math.min(INTRO_SCROLL_NUDGE_PX, Math.max(0, maxScrollTop - currentScrollTop));

  if (nudgeDistance < 1) {
    return;
  }

  const easeOutCubic = (progress) => 1 - (1 - progress) ** 3;
  const startTime = performance.now();

  const animateScroll = (timestamp) => {
    const elapsed = timestamp - startTime;
    const progress = clamp(elapsed / INTRO_SCROLL_NUDGE_DURATION_MS, 0, 1);
    const easedProgress = easeOutCubic(progress);
    const nextScrollTop = currentScrollTop + nudgeDistance * easedProgress;

    window.scrollTo(0, nextScrollTop);

    if (progress < 1) {
      window.requestAnimationFrame(animateScroll);
    }
  };

  window.requestAnimationFrame(animateScroll);
}

function ensureMobileOnlyNotice() {
  const existingNoticeElement = document.querySelector(`[${MOBILE_ONLY_NOTICE_MARKER}]`);

  if (existingNoticeElement) {
    return existingNoticeElement;
  }

  const noticeElement = document.createElement("aside");
  noticeElement.className = "mobile-only-notice";
  noticeElement.setAttribute(MOBILE_ONLY_NOTICE_MARKER, "");
  noticeElement.setAttribute("role", "status");
  noticeElement.setAttribute("aria-live", "polite");
  noticeElement.hidden = true;
  noticeElement.innerHTML = `
    <div class="mobile-only-notice__content">
      <p class="mobile-only-notice__title">Откройте приглашение на телефоне</p>
      <p class="mobile-only-notice__text">Эта страница доступна на экранах до 525px.</p>
    </div>
  `;

  document.body.append(noticeElement);
  return noticeElement;
}

function bindMobileOnlyMode(sceneRoot) {
  const rootElement = document.documentElement;
  const noticeElement = ensureMobileOnlyNotice();

  const updateMobileOnlyMode = () => {
    const isDesktopViewport = !isMobileViewportWidth();

    rootElement.classList.toggle(DESKTOP_BLOCK_CLASS, isDesktopViewport);
    noticeElement.hidden = !isDesktopViewport;

    if (isDesktopViewport) {
      sceneRoot.setAttribute("aria-hidden", "true");
      rootElement.classList.remove(INTRO_HEIGHT_LIMIT_CLASS);
      window.scrollTo(0, 0);
      return;
    }

    sceneRoot.removeAttribute("aria-hidden");
  };

  updateMobileOnlyMode();
  window.addEventListener("resize", updateMobileOnlyMode, { passive: true });
  window.addEventListener("orientationchange", updateMobileOnlyMode);
}

function limitPageHeightForIntro() {
  const rootElement = document.documentElement;

  if (!isMobileViewportWidth()) {
    rootElement.classList.remove(INTRO_HEIGHT_LIMIT_CLASS);
    return;
  }

  rootElement.classList.add(INTRO_HEIGHT_LIMIT_CLASS);

  window.setTimeout(() => {
    rootElement.classList.remove(INTRO_HEIGHT_LIMIT_CLASS);

    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        nudgeScrollAvailability();
      });
    }, INTRO_SCROLL_NUDGE_DELAY_MS);
  }, INTRO_HEIGHT_LIMIT_MS);
}

function bindNamesReveal(sceneRoot) {
  const videoElement = sceneRoot.querySelector("[data-hero-video]");

  if (!videoElement) {
    return;
  }

  let namesAnimationStarted = false;
  let namesRevealTimerId = null;

  const showNames = async () => {
    if (namesAnimationStarted) {
      return;
    }

    namesAnimationStarted = true;
    sceneRoot.classList.add(NAMES_VISIBLE_CLASS);
    sceneRoot.classList.add(PHOTO_VISIBLE_CLASS);
    await playTypingAnimation(sceneRoot);
  };

  const scheduleNamesReveal = () => {
    if (namesAnimationStarted || namesRevealTimerId !== null) {
      return;
    }

    namesRevealTimerId = window.setTimeout(() => {
      showNames();
    }, TYPING_START_DELAY_MS);
  };

  const handleVideoEnded = () => {
    freezeLastVideoFrame(videoElement);
    showNames();
  };

  videoElement.addEventListener("playing", scheduleNamesReveal, { once: true });
  videoElement.addEventListener("ended", handleVideoEnded);
  videoElement.addEventListener("error", showNames);

  if (!videoElement.paused && videoElement.currentTime > 0) {
    scheduleNamesReveal();
  }

  const playAttempt = videoElement.play();

  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(() => {
      // Browsers can block autoplay despite muted; reveal logic still works after manual play.
    });
  }
}

function bindPlaceArrow(sceneRoot) {
  const placeElement = sceneRoot.querySelector(PLACE_SELECTOR);

  if (!placeElement) {
    return;
  }

  const arrowSvgElement = placeElement.querySelector(PLACE_ARROW_SVG_SELECTOR);
  const arrowPathElement = placeElement.querySelector(PLACE_ARROW_PATH_SELECTOR);
  const weddingImageElement = placeElement.querySelector(PLACE_WEDDING_IMAGE_SELECTOR);
  const meetingImageElement = placeElement.querySelector(PLACE_MEETING_IMAGE_SELECTOR);

  if (!arrowSvgElement || !arrowPathElement || !weddingImageElement || !meetingImageElement) {
    return;
  }

  let rafId = 0;

  const updateArrowPath = () => {
    rafId = 0;

    const placeRect = placeElement.getBoundingClientRect();
    const weddingRect = weddingImageElement.getBoundingClientRect();
    const meetingRect = meetingImageElement.getBoundingClientRect();

    if (!placeRect.width || !placeRect.height || !weddingRect.width || !meetingRect.width) {
      return;
    }

    const startX = weddingRect.right - placeRect.left - PLACE_ANCHOR_OFFSET_PX + PLACE_TOP_POINT_SHIFT_X_PX;
    const startY = weddingRect.bottom - placeRect.top - PLACE_ANCHOR_OFFSET_PX + PLACE_TOP_POINT_SHIFT_Y_PX;
    const endX = meetingRect.left - placeRect.left + PLACE_ANCHOR_OFFSET_PX + PLACE_BOTTOM_POINT_SHIFT_X_PX;
    const endY = meetingRect.top - placeRect.top + PLACE_ANCHOR_OFFSET_PX + PLACE_BOTTOM_POINT_SHIFT_Y_PX;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance < 1) {
      return;
    }

    const bendDirectionX = deltaX >= 0 ? -1 : 1;
    const sideBend = clamp(distance * 1.35, 220, 560);
    const verticalBend = clamp(distance * 0.56, 86, 280);
    const centerLift = clamp(distance * 0.2, 24, 84);
    const controlOneX = startX + sideBend * bendDirectionX;
    const controlOneY = startY + verticalBend - centerLift;
    const controlTwoX = endX - sideBend * bendDirectionX;
    const controlTwoY = endY - verticalBend * 0.62 - centerLift;
    const strokeWidth = clamp(distance * 0.009, 2.2, 3.6);
    const pathData = `M ${startX.toFixed(2)} ${startY.toFixed(2)} C ${controlOneX.toFixed(2)} ${controlOneY.toFixed(2)} ${controlTwoX.toFixed(2)} ${controlTwoY.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)}`;

    arrowSvgElement.setAttribute("viewBox", `0 0 ${placeRect.width.toFixed(2)} ${placeRect.height.toFixed(2)}`);
    arrowPathElement.setAttribute("d", pathData);
    arrowPathElement.setAttribute("stroke-width", strokeWidth.toFixed(2));
  };

  const scheduleArrowUpdate = () => {
    if (rafId) {
      return;
    }

    rafId = window.requestAnimationFrame(updateArrowPath);
  };

  scheduleArrowUpdate();
  window.addEventListener("resize", scheduleArrowUpdate, { passive: true });
  window.addEventListener("orientationchange", scheduleArrowUpdate);

  const weddingInnerImage = weddingImageElement.querySelector(PLACE_IMAGE_TAG_SELECTOR);
  const meetingInnerImage = meetingImageElement.querySelector(PLACE_IMAGE_TAG_SELECTOR);

  weddingInnerImage?.addEventListener("load", scheduleArrowUpdate);
  meetingInnerImage?.addEventListener("load", scheduleArrowUpdate);

  if (typeof ResizeObserver === "function") {
    const resizeObserver = new ResizeObserver(scheduleArrowUpdate);
    resizeObserver.observe(placeElement);
    resizeObserver.observe(weddingImageElement);
    resizeObserver.observe(meetingImageElement);
  }
}

export async function initializeScene() {
  const sceneRoot = document.querySelector("[data-scene]");

  if (!sceneRoot) {
    return;
  }

  const videoElement = sceneRoot.querySelector("[data-hero-video]");

  if (videoElement) {
    videoElement.dataset.videoVariant = "default";
  }

  bindMobileOnlyMode(sceneRoot);
  sceneRoot.classList.remove(PHOTO_VISIBLE_CLASS);
  sceneRoot.classList.remove(READY_CLASS);
  sceneRoot.classList.add(SCENE_BOOTSTRAP_PENDING_CLASS);
  prepareTypingLines(sceneRoot);

  await preloadSceneAssets(sceneRoot, videoElement);
  limitPageHeightForIntro();
  bindNamesReveal(sceneRoot);
  bindPlaceArrow(sceneRoot);

  window.requestAnimationFrame(() => {
    sceneRoot.classList.remove(SCENE_BOOTSTRAP_PENDING_CLASS);
    sceneRoot.classList.add(READY_CLASS);
  });
}
