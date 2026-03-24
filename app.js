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
const clearSearchBtn = document.getElementById("clearSearchBtn");
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

function getSearchText() {
  return searchInput.value.trim().toLowerCase();
}

function hasActiveSearch() {
  return getSearchText().length > 0;
}

function updateClearButton() {
  if (hasActiveSearch()) {
    clearSearchBtn.classList.remove("hidden");
  } else {
    clearSearchBtn.classList.add("hidden");
  }
}

function getCurrentCategoryObject() {
  return state.data.find((item) => item.category === state.activeCategory) || null;
}

function getFilteredVideos() {
  const searchText = getSearchText();

  if (searchText) {
    const results = [];

    state.data.forEach((categoryItem) => {
      categoryItem.videos.forEach((video) => {
        const combined = `${video.title} ${video.description || ""}`.toLowerCase();
        if (combined.includes(searchText)) {
          results.push({
            ...video,
            matchedCategory: categoryItem.category
          });
        }
      });
    });

    return results;
  }

  const currentCategory = getCurrentCategoryObject();
  if (!currentCategory) return [];

  return currentCategory.videos.map((video) => ({
    ...video,
    matchedCategory: currentCategory.category
  }));
}

function queueFacebookParse(target, onDone) {
  if (!target) return;

  const runDone = () => {
    if (typeof onDone === "function") onDone();
  };

  if (window.fbSdkReady && window.FB && window.FB.XFBML) {
    window.FB.XFBML.parse(target, runDone);
    setTimeout(runDone, 350);
    setTimeout(runDone, 900);
    setTimeout(runDone, 1400);
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
      setTimeout(() => {
        if (typeof item.onDone === "function") item.onDone();
      }, 1400);
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

    if (!hasActiveSearch() && item.category === state.activeCategory) {
      btn.classList.add("active");
    }

    btn.addEventListener("click", () => {
      state.activeCategory = item.category;
      state.activeVideoIndex = 0;

      // search active থাকলেও category click করলে
      // list ঠিকমতো rerender হবে
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

    if (!isMobileView()) {
      previewBox.innerHTML = `
        <div class="preview-empty">
          <div>
            <div class="mb-3 text-5xl">🔍</div>
            <h3 class="text-xl font-bold text-slate-900">কোনো ভিডিও পাওয়া যায়নি</h3>
            <p class="mt-2 text-slate-500">অন্য keyword লিখে আবার search করুন</p>
          </div>
        </div>
      `;
    }
    return;
  }

  filteredVideos.forEach((video, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "video-card";

    if (index === state.activeVideoIndex) {
      card.classList.add("active-video");
    }

    const categoryLabel = hasActiveSearch()
      ? `<div class="mt-1 text-xs font-medium text-violet-700">${escapeHtml(video.matchedCategory || "")}</div>`
      : "";

    card.innerHTML = `
      <div class="video-card-title line-clamp-2 line-clamp-title">${escapeHtml(video.title)}</div>
      ${categoryLabel}
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

function createEmbedMarkup(video, width = 520) {
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

function renderPreview() {
  const filteredVideos = getFilteredVideos();
  if (!filteredVideos.length) return;

  const video = filteredVideos[state.activeVideoIndex];
  const badgeCategory = video.matchedCategory || state.activeCategory;

  previewBox.innerHTML = `
    <div class="preview-layout">
      <div class="player-area">
        <div class="player-embed-wrap" id="desktopEmbedMount"></div>
      </div>

      <div class="player-info">
        <div class="player-info-top">
          <span class="player-badge">${escapeHtml(badgeCategory)}</span>
          <h2 class="player-title">${escapeHtml(video.title)}</h2>
        </div>
        <p class="player-desc">${escapeHtml(video.description || "")}</p>
      </div>
    </div>
  `;

  const mount = document.getElementById("desktopEmbedMount");
  const embedWidth = getEmbedWidth(mount, 520);

  mount.innerHTML = createEmbedMarkup(video, embedWidth);
  queueFacebookParse(mount, () => fitEmbedContent(mount));
}

function openMobileModal() {
  const filteredVideos = getFilteredVideos();
  if (!filteredVideos.length) return;

  const video = filteredVideos[state.activeVideoIndex];
  const badgeCategory = video.matchedCategory || state.activeCategory;

  modalContent.innerHTML = `
    <div class="modal-layout">
      <div class="modal-player-wrap">
        <div class="modal-player-inner" id="mobileEmbedMount"></div>
      </div>

      <div class="player-info">
        <div class="player-info-top">
          <span class="player-badge">${escapeHtml(badgeCategory)}</span>
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

  requestAnimationFrame(() => {
    const mount = document.getElementById("mobileEmbedMount");
    const embedWidth = getEmbedWidth(mount, 340);

    mount.innerHTML = createEmbedMarkup(video, embedWidth);
    queueFacebookParse(mount, () => fitEmbedContent(mount));
  });
}

function closeModal() {
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
  updateClearButton();
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
  const mobileMount = document.getElementById("mobileEmbedMount");

  fitEmbedContent(desktopMount);
  fitEmbedContent(mobileMount);
}

function reparseVisibleEmbeds() {
  const desktopMount = document.getElementById("desktopEmbedMount");
  const mobileMount = document.getElementById("mobileEmbedMount");

  if (desktopMount && !isMobileView()) {
    queueFacebookParse(desktopMount, () => fitEmbedContent(desktopMount));
  }

  if (mobileMount && isMobileView()) {
    queueFacebookParse(mobileMount, () => fitEmbedContent(mobileMount));
  }
}

searchInput.addEventListener("input", () => {
  state.activeVideoIndex = 0;
  renderAll();
});

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  state.activeVideoIndex = 0;
  renderAll();
  searchInput.focus();
});

closeModalBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  closeModal();
});

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
    refitVisibleEmbeds();
    state.resizeTicking = false;
  });
});

document.addEventListener("fullscreenchange", () => {
  setTimeout(refitVisibleEmbeds, 120);
  setTimeout(reparseVisibleEmbeds, 350);
});

window.addEventListener("orientationchange", () => {
  setTimeout(refitVisibleEmbeds, 200);
  setTimeout(reparseVisibleEmbeds, 500);
});
const notices = [
  "নতুন বাংলা ব্যাকরণ ভিডিও আপলোড করা হয়েছে",
  "ইংরেজি tense এর নতুন tutorial এখন লাইভ",
  "গণিত শর্টকাট সিরিজ দ্রুত যোগ করা হবে",
  "কম্পিউটার বেসিক ভিডিও নিয়মিত আপডেট করা হচ্ছে",
  "সর্বশেষ ভিডিও দেখতে ক্যাটাগরি থেকে নির্বাচন করুন"
];

function renderNotices() {
  const noticeTrack = document.getElementById("noticeTrack");
  if (!noticeTrack) return;

  const singleSet = notices
    .map((item) => `<span>📢 ${item}</span>`)
    .join("");

  /* seamless scroll এর জন্য 2 বার */
  noticeTrack.innerHTML = singleSet + singleSet;
}

window.addEventListener("load", loadData);