const state = {
  data: [],
  activeCategory: "",
  activeVideoIndex: 0,
  pendingParseTargets: [],
  resizeTicking: false
};

const categoryList = document.getElementById("categoryList");
const videoList = document.getElementById("videoList");
const previewBox = document.getElementById("previewBox");
const searchInput = document.getElementById("searchInput");
const videoCount = document.getElementById("videoCount");
const videoModal = document.getElementById("videoModal");
const modalContent = document.getElementById("modalContent");
const closeModalBtn = document.getElementById("closeModalBtn");

function isMobileView() {
  return window.innerWidth < 1280;
}

function escapeHtml(text = "") {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getCurrentCategoryObject() {
  return state.data.find((item) => item.category === state.activeCategory) || null;
}

function getFilteredVideos() {
  const currentCategory = getCurrentCategoryObject();
  if (!currentCategory) return [];

  const searchText = searchInput.value.trim().toLowerCase();

  return currentCategory.videos.filter((video) => {
    const combined = `${video.title} ${video.description || ""}`.toLowerCase();
    return combined.includes(searchText);
  });
}

function queueFacebookParse(target, onDone) {
  if (!target) return;

  const runParse = () => {
    if (window.FB && window.FB.XFBML) {
      window.FB.XFBML.parse(target, () => {
        if (typeof onDone === "function") onDone();
      });
      setTimeout(() => {
        if (typeof onDone === "function") onDone();
      }, 350);
      setTimeout(() => {
        if (typeof onDone === "function") onDone();
      }, 900);
      return true;
    }
    return false;
  };

  if (window.fbSdkReady) {
    runParse();
    return;
  }

  state.pendingParseTargets.push({ target, onDone });
}

window.onFacebookSdkReady = function () {
  while (state.pendingParseTargets.length) {
    const item = state.pendingParseTargets.shift();
    if (!item || !item.target) continue;

    if (window.FB && window.FB.XFBML) {
      window.FB.XFBML.parse(item.target, () => {
        if (typeof item.onDone === "function") item.onDone();
      });
      setTimeout(() => {
        if (typeof item.onDone === "function") item.onDone();
      }, 350);
      setTimeout(() => {
        if (typeof item.onDone === "function") item.onDone();
      }, 900);
    }
  }
};

function getEmbedWidth(container, fallback = 520) {
  if (!container) return fallback;

  const containerWidth = Math.floor(container.clientWidth || fallback);
  const containerHeight = Math.floor(container.clientHeight || 0);

  const portraitSafeWidth = containerHeight > 0
    ? Math.floor((containerHeight * 9) / 16)
    : fallback;

  const bestWidth = Math.min(containerWidth - 24, portraitSafeWidth || containerWidth - 24);
  return Math.max(280, bestWidth);
}

function fitEmbedContent(target) {
  if (!target) return;

  const stage = target.querySelector(".embed-fit-stage");
  const center = target.querySelector(".embed-fit-center");
  if (!stage || !center) return;

  const injectedRoot = center.firstElementChild;
  if (!injectedRoot) return;

  const stageRect = stage.getBoundingClientRect();
  if (!stageRect.width || !stageRect.height) return;

  const contentWidth = injectedRoot.offsetWidth || injectedRoot.scrollWidth || 0;
  const contentHeight = injectedRoot.offsetHeight || injectedRoot.scrollHeight || 0;
  if (!contentWidth || !contentHeight) return;

  const scale = Math.min(
    stageRect.width / contentWidth,
    stageRect.height / contentHeight
  );

  center.style.width = `${contentWidth}px`;
  center.style.height = `${contentHeight}px`;
  center.style.transform = `translateX(-50%) scale(${scale})`;
}

function renderCategories() {
  categoryList.innerHTML = "";

  state.data.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "category-btn";
    btn.textContent = item.category;

    if (item.category === state.activeCategory) {
      btn.classList.add("active");
    }

    btn.addEventListener("click", () => {
      state.activeCategory = item.category;
      state.activeVideoIndex = 0;
      renderAll();
    });

    categoryList.appendChild(btn);
  });
}

function renderVideos() {
  const filteredVideos = getFilteredVideos();
  videoList.innerHTML = "";
  videoCount.textContent = `${filteredVideos.length} টি`;

  if (state.activeVideoIndex >= filteredVideos.length) {
    state.activeVideoIndex = 0;
  }

  if (!filteredVideos.length) {
    videoList.innerHTML = `
      <div class="rounded-xl bg-white/70 p-4 text-sm text-slate-700">
        কোনো ভিডিও পাওয়া যায়নি।
      </div>
    `;

    previewBox.innerHTML = `
      <div class="preview-empty">
        <div>
          <div class="mb-3 text-5xl">🔍</div>
          <h3 class="text-xl font-bold text-slate-900">কোনো ভিডিও পাওয়া যায়নি</h3>
          <p class="mt-2 text-slate-500">অন্য keyword লিখে আবার search করুন</p>
        </div>
      </div>
    `;
    return;
  }

  filteredVideos.forEach((video, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "video-card";

    if (index === state.activeVideoIndex) {
      card.classList.add("active-video");
    }

    card.innerHTML = `
      <div class="video-card-title line-clamp-2 line-clamp-title">${escapeHtml(video.title)}</div>
    `;

    card.addEventListener("click", () => {
      state.activeVideoIndex = index;
      renderVideos();

      if (isMobileView()) {
        openMobileModal();
      } else {
        renderPreview();
      }
    });

    videoList.appendChild(card);
  });
}

function createDesktopEmbedMarkup(video, width = 520) {
  return `
    <div class="embed-fit-stage">
      <div class="embed-fit-center">
        <div
          class="fb-video"
          data-href="${video.fbUrl}"
          data-width="${width}"
          data-show-text="false"
          data-allowfullscreen="true">
          <blockquote cite="${video.fbUrl}" class="fb-xfbml-parse-ignore">
            <a href="${video.fbUrl}" target="_blank" rel="noopener noreferrer">
              ভিডিও দেখুন
            </a>
          </blockquote>
        </div>
      </div>
    </div>
  `;
}

function createMobileEmbedMarkup(video, width = 340) {
  return `
    <div class="embed-mobile-stage">
      <div
        class="fb-video"
        data-href="${video.fbUrl}"
        data-width="${width}"
        data-show-text="false"
        data-allowfullscreen="true">
        <blockquote cite="${video.fbUrl}" class="fb-xfbml-parse-ignore">
          <a href="${video.fbUrl}" target="_blank" rel="noopener noreferrer">
            ভিডিও দেখুন
          </a>
        </blockquote>
      </div>
    </div>
  `;
}

function renderPreview() {
  const filteredVideos = getFilteredVideos();
  if (!filteredVideos.length) return;

  const video = filteredVideos[state.activeVideoIndex];

  previewBox.innerHTML = `
    <div class="preview-layout">
      <div class="player-area">
        <div class="player-embed-wrap" id="desktopEmbedMount"></div>
      </div>

      <div class="player-info">
        <div class="player-info-top">
          <span class="player-badge">${escapeHtml(state.activeCategory)}</span>
          <h2 class="player-title">${escapeHtml(video.title)}</h2>
        </div>
        <p class="player-desc">${escapeHtml(video.description || "")}</p>
      </div>
    </div>
  `;

  const mount = document.getElementById("desktopEmbedMount");
  const embedWidth = getEmbedWidth(mount, 520);

  mount.innerHTML = createDesktopEmbedMarkup(video, embedWidth);
  queueFacebookParse(mount, () => fitEmbedContent(mount));
}

function openMobileModal() {
  const filteredVideos = getFilteredVideos();
  if (!filteredVideos.length) return;

  const video = filteredVideos[state.activeVideoIndex];

  modalContent.innerHTML = `
    <div class="modal-layout">
      <div class="modal-player-wrap">
        <div class="modal-player-inner" id="mobileEmbedMount"></div>
      </div>

      <div class="player-info">
        <div class="player-info-top">
          <span class="player-badge">${escapeHtml(state.activeCategory)}</span>
          <h2 class="player-title">${escapeHtml(video.title)}</h2>
        </div>
        <p class="player-desc">${escapeHtml(video.description || "")}</p>
      </div>
    </div>
  `;

  videoModal.classList.remove("hidden");
  videoModal.classList.add("flex");
  videoModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("overflow-hidden");

  const mount = document.getElementById("mobileEmbedMount");
  const embedWidth = Math.max(280, Math.min(420, window.innerWidth - 48));

  mount.innerHTML = createMobileEmbedMarkup(video, embedWidth);

  const panel = videoModal.querySelector(".modal-panel");
  panel.addEventListener("click", stopModalInnerClick, true);

  queueFacebookParse(mount);
}

function stopModalInnerClick(event) {
  event.stopPropagation();
}

function closeModal() {
  const panel = videoModal.querySelector(".modal-panel");
  panel.removeEventListener("click", stopModalInnerClick, true);

  videoModal.classList.add("hidden");
  videoModal.classList.remove("flex");
  videoModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("overflow-hidden");

  modalContent.innerHTML = `
    <div class="preview-empty min-h-[320px]">
      <div>
        <div class="mb-3 text-5xl">🎬</div>
        <p class="text-slate-500">এখানে ভিডিও লোড হবে</p>
      </div>
    </div>
  `;
}

function renderAll() {
  renderCategories();
  renderVideos();

  if (!isMobileView()) {
    renderPreview();
  }
}

async function loadData() {
  try {
    const response = await fetch("./videos.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("ভিডিও ডাটা লোড করা যায়নি");
    }

    const json = await response.json();
    state.data = Array.isArray(json.categories) ? json.categories : [];

    if (!state.data.length) {
      throw new Error("কোনো category পাওয়া যায়নি");
    }

    state.activeCategory = state.data[0].category;
    state.activeVideoIndex = 0;
    renderAll();
  } catch (error) {
    previewBox.innerHTML = `
      <div class="preview-empty">
        <div>
          <div class="mb-3 text-5xl">⚠️</div>
          <h3 class="text-2xl font-bold text-slate-900">ডাটা লোড হয়নি</h3>
          <p class="mt-2 text-slate-500">${escapeHtml(error.message)}</p>
          <p class="mt-2 text-slate-500">Live Server / localhost / Vercel দিয়ে চালান।</p>
        </div>
      </div>
    `;
  }
}

function refitVisibleEmbeds() {
  const desktopMount = document.getElementById("desktopEmbedMount");
  fitEmbedContent(desktopMount);
}

searchInput.addEventListener("input", () => {
  state.activeVideoIndex = 0;
  renderVideos();

  if (!isMobileView()) {
    renderPreview();
  }
});

closeModalBtn.addEventListener("click", closeModal);

videoModal.addEventListener("click", (event) => {
  if (event.target === videoModal) {
    closeModal();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !videoModal.classList.contains("hidden")) {
    closeModal();
  }
});

window.addEventListener("resize", () => {
  if (state.resizeTicking) return;

  state.resizeTicking = true;
  requestAnimationFrame(() => {
    if (!isMobileView()) {
      closeModal();
      renderPreview();
    } else {
      refitVisibleEmbeds();
    }
    state.resizeTicking = false;
  });
});

window.addEventListener("load", loadData);