const videoLinkInput = document.querySelector("#vd-linkInput");
const videoDownloadButton = document.querySelector("#vd-downloadButton");
const videoCopySelected = document.querySelector("#vd-copySelected");
const videoClearLinks = document.querySelector("#vd-clearLinks");
const videoMessage = document.querySelector("#vd-message");
const videoStatus = document.querySelector("#vd-status");
const videoRows = document.querySelector("#vd-recordRows");
const videoEmpty = document.querySelector("#vd-empty");
const videoSelectAll = document.querySelector("#vd-selectAll");
const VIDEO_URL_PATTERN = /(?:https?:\/\/|u\.lingshi)[^\s，,;；"'<>\u4e00-\u9fff]+/gi;

let videoRecords = [];
const capturedVideoUrls = new Set();

function setVideoMessage(message, isError = false) {
  if (!videoMessage) return;
  videoMessage.textContent = message || "";
  videoMessage.classList.toggle("is-error", isError);
}

function escapeVideoText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeHtmlEntities(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(value || "");
  return textarea.value;
}

function decodeUnicodeEscapes(value) {
  return String(value || "").replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function normalizeLinkText(value) {
  return decodeHtmlEntities(decodeUnicodeEscapes(value))
    .replace(/：/g, ":")
    .replace(/／/g, "/")
    .replace(/？/g, "?")
    .replace(/＆/g, "&")
    .replace(/＝/g, "=")
    .replace(/\\\//g, "/")
    .replace(/https?\s*:\s*\/\s*\//gi, (match) => match.replace(/\s/g, ""));
}

function urlSearchTexts(value) {
  const seen = new Set();
  const queue = [String(value || "")];
  const results = [];

  while (queue.length && results.length < 12) {
    const text = queue.shift();
    if (seen.has(text)) continue;
    seen.add(text);

    const normalized = normalizeLinkText(text);
    results.push(normalized);

    try {
      const decoded = decodeURIComponent(normalized);
      if (decoded !== normalized && !seen.has(decoded)) {
        queue.push(decoded);
      }
    } catch (error) {
      // Some pasted chat records contain partial percent-encoding. The raw text is still searched.
    }
  }

  return results;
}

function cleanVideoUrl(value) {
  const text = String(value || "")
    .trim()
    .replace(/&amp;/gi, "&")
    .replace(/[。).,，;；、"'“”’】\]\}＞>]+$/g, "");
  return /^u\.lingshi/i.test(text) ? `https://${text}` : text;
}

function uniqueVideoUrls(urls) {
  const seen = new Set();
  return urls
    .map(cleanVideoUrl)
    .filter((url) => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

function extractUrlsFromText(text) {
  return uniqueVideoUrls(urlSearchTexts(text).flatMap((candidate) => candidate.match(VIDEO_URL_PATTERN) || []));
}

function extractUrlsFromHtml(html) {
  const urls = extractUrlsFromText(html);
  if (!html) return urls;

  const documentFromHtml = new DOMParser().parseFromString(html, "text/html");
  documentFromHtml.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      urls.push(...extractUrlsFromText(attribute.value));
    });
  });
  documentFromHtml.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (/^(https?:\/\/|u\.lingshi)/i.test(href)) {
      urls.push(href);
    }
  });

  return uniqueVideoUrls(urls);
}

function appendCapturedUrlsToInput(urls) {
  if (!videoLinkInput || !urls.length) return;

  const currentValue = videoLinkInput.value || "";
  const missingUrls = urls.filter((url) => !currentValue.includes(url));
  if (!missingUrls.length) return;

  videoLinkInput.value = [currentValue.trim(), missingUrls.join("\n")].filter(Boolean).join("\n");
}

function rememberCapturedUrls(urls) {
  const cleanUrls = uniqueVideoUrls(urls);
  cleanUrls.forEach((url) => capturedVideoUrls.add(url));
  if (cleanUrls.length) {
    setVideoMessage(`已识别 ${capturedVideoUrls.size} 条视频链接。`);
  }
  return cleanUrls;
}

function combinedVideoRawText() {
  const inputText = videoLinkInput?.value.trim() || "";
  const capturedText = [...capturedVideoUrls].join("\n");
  return [inputText, capturedText].filter(Boolean).join("\n");
}

async function getClipboardItemText(item, type) {
  const blob = await item.getType(type);
  return blob.text();
}

async function readUrlsFromClipboard() {
  const urls = [];

  if (navigator.clipboard?.read) {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (!type.startsWith("text/")) continue;
          const text = await getClipboardItemText(item, type);
          urls.push(...(type.includes("html") ? extractUrlsFromHtml(text) : extractUrlsFromText(text)));
        }
      }
    } catch (error) {
      // Browser permissions vary; paste-event extraction still covers normal use.
    }
  }

  if (!urls.length && navigator.clipboard?.readText) {
    try {
      urls.push(...extractUrlsFromText(await navigator.clipboard.readText()));
    } catch (error) {
      // Ignore permission failures and keep the normal pasted text path.
    }
  }

  return rememberCapturedUrls(urls);
}

function formatFileSize(size) {
  const value = Number(size || 0);
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

async function videoApiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: options.body ? { "Content-Type": "application/json" } : {},
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "请求失败，请稍后重试。");
  }
  return data;
}

function selectedVideoRecords() {
  const ids = new Set(
    [...document.querySelectorAll("[data-video-select]:checked")].map((checkbox) => checkbox.value)
  );
  return videoRecords.filter((record) => ids.has(record.id));
}

function renderVideoRows() {
  if (!videoRows || !videoEmpty || !videoStatus) return;

  videoStatus.textContent = `${videoRecords.length} 个视频`;
  videoRows.innerHTML = videoRecords
    .map((record) => {
      const fileUrl = record.file_url || "#";
      return `
        <tr>
          <td><input type="checkbox" value="${escapeVideoText(record.id)}" data-video-select aria-label="选择 ${escapeVideoText(record.filename)}"></td>
          <td class="video-student-cell">${escapeVideoText(record.student_name)}</td>
          <td>${escapeVideoText(record.filename)}</td>
          <td>${formatFileSize(record.size)}</td>
          <td>${escapeVideoText(record.created_at)}</td>
          <td><a class="video-download-link" href="${escapeVideoText(fileUrl)}" download="${escapeVideoText(record.filename)}">下载</a></td>
        </tr>
      `;
    })
    .join("");

  videoEmpty.classList.toggle("is-hidden", videoRecords.length > 0);
  if (videoSelectAll) {
    videoSelectAll.checked = false;
  }
}

async function loadVideoRecords() {
  if (!videoRows) return;
  const data = await videoApiRequest("/api/videos");
  videoRecords = data.records || [];
  renderVideoRows();
}

async function downloadVideos() {
  let rawText = combinedVideoRawText();
  let knownUrls = extractUrlsFromText(rawText);
  if (!rawText || !knownUrls.length) {
    const clipboardUrls = await readUrlsFromClipboard();
    appendCapturedUrlsToInput(clipboardUrls);
    rawText = combinedVideoRawText();
    knownUrls = extractUrlsFromText(rawText);
    if (!rawText || !knownUrls.length) {
      setVideoMessage("未识别到视频链接。请确认微信复制内容里包含可打开的 u.lingshi 或 http/https 链接。", true);
      return;
    }
  }

  videoDownloadButton.disabled = true;
  setVideoMessage("正在下载视频，视频较大时需要等待一会儿...");
  try {
    const data = await videoApiRequest("/api/videos/download", {
      method: "POST",
      body: JSON.stringify({ raw_text: rawText }),
    });
    await loadVideoRecords();

    const successCount = (data.records || []).length;
    const failCount = (data.errors || []).length;
    if (failCount) {
      const errorSummary = data.errors
        .slice(0, 3)
        .map((error) => `${error.student_name || "未命名视频"}：${error.error}`)
        .join("；");
      setVideoMessage(`已下载 ${successCount} 个，失败 ${failCount} 个：${errorSummary}`, true);
    } else {
      setVideoMessage(`已下载 ${successCount} 个视频。`);
    }
  } finally {
    videoDownloadButton.disabled = false;
  }
}

async function copySelectedVideos() {
  const selected = selectedVideoRecords();
  if (!selected.length) {
    setVideoMessage("请先勾选要复制的视频。", true);
    return;
  }

  const text = selected
    .map((record) => `${record.student_name}\t${record.filename}\t${window.location.origin}${record.file_url}`)
    .join("\n");
  await navigator.clipboard.writeText(text);
  setVideoMessage(`已复制 ${selected.length} 个视频信息。`);
}

function initVideoDownload() {
  if (!videoRows) return;

  videoLinkInput?.addEventListener("paste", (event) => {
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const plainText = clipboardData.getData("text/plain");
    const htmlText = clipboardData.getData("text/html");
    const rtfText = clipboardData.getData("text/rtf");
    const uriList = clipboardData.getData("text/uri-list");
    const urls = rememberCapturedUrls([
      ...extractUrlsFromText(plainText),
      ...extractUrlsFromHtml(htmlText),
      ...extractUrlsFromText(rtfText),
      ...extractUrlsFromText(uriList),
    ]);

    if (urls.length) {
      setTimeout(() => appendCapturedUrlsToInput(urls), 0);
    }

    [...clipboardData.items].forEach((item) => {
      if (item.kind !== "string") return;
      item.getAsString((value) => {
        const itemUrls = rememberCapturedUrls(
          item.type.includes("html") ? extractUrlsFromHtml(value) : extractUrlsFromText(value)
        );
        appendCapturedUrlsToInput(itemUrls);
      });
    });
  });

  videoLinkInput?.addEventListener("input", () => {
    capturedVideoUrls.clear();
    rememberCapturedUrls(extractUrlsFromText(videoLinkInput.value));
  });

  videoDownloadButton?.addEventListener("click", async () => {
    try {
      await downloadVideos();
    } catch (error) {
      setVideoMessage(error.message, true);
    }
  });

  videoCopySelected?.addEventListener("click", async () => {
    try {
      await copySelectedVideos();
    } catch (error) {
      setVideoMessage("复制失败，请重新选择后再试。", true);
    }
  });

  videoClearLinks?.addEventListener("click", () => {
    if (videoLinkInput) videoLinkInput.value = "";
    capturedVideoUrls.clear();
    setVideoMessage("");
  });

  videoSelectAll?.addEventListener("change", () => {
    document.querySelectorAll("[data-video-select]").forEach((checkbox) => {
      checkbox.checked = videoSelectAll.checked;
    });
  });

  loadVideoRecords().catch((error) => setVideoMessage(error.message, true));
}

initVideoDownload();
