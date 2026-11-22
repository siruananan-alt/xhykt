(() => {
  'use strict';

  const lessons = WinterCatalog.lessons.map(lesson => ({...lesson, playlist: []}));
  let loading = true;
  let unavailable = false;
  const legacyKey = 'xinghe:winter:2026:completed';
  const storageKey = 'xinghe:winter:2026:finished-lessons';
  const segmentKey = legacyKey + ':segments';
  const guideProgressKey = storageKey + ':guide-videos';
  const guideIndex = 4;
  const completed = new Set();
  let guideProgress = null;
  let savedSegments = null;
  try {
    const previousCount = Number(localStorage.getItem(legacyKey));
    if (Number.isInteger(previousCount) && previousCount >= 0 && previousCount <= lessons.length) {
      for (let index = 0; index < previousCount; index++) completed.add(index);
    }
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) {
      saved.filter(index => Number.isInteger(index) && index >= 0 && index < lessons.length)
        .forEach(index => completed.add(index));
    }
    savedSegments = JSON.parse(localStorage.getItem(segmentKey));
    guideProgress = JSON.parse(localStorage.getItem(guideProgressKey));
  } catch {
    // Playback still works for the current page without storage.
  }
  let active = -1;
  let segment = 0;
  const list = document.getElementById('winter-list');
  const progress = document.getElementById('winter-progress');
  const player = document.getElementById('winter-player');
  const heading = document.getElementById('winter-playing');
  const video = document.getElementById('winter-video');
  const status = document.getElementById('winter-status');
  const retry = document.getElementById('winter-retry');
  function playlistKey(lesson) {
    return JSON.stringify(lesson.playlist.map(item => item.url));
  }

  function playSegment(index, position) {
    const lesson = lessons[index];
    const item = lesson.playlist[position];
    active = index;
    segment = position;
    player.hidden = false;
    heading.textContent = lesson.title + (lesson.playlist.length > 1
      ? ' · 第 ' + (position + 1) + ' / ' + lesson.playlist.length + ' 段' + (item.title ? ' · ' + item.title : '')
      : '');
    heading.focus();
    status.textContent = '';
    if (video.getAttribute('src') !== item.url) video.src = item.url;
    video.play().catch(() => {
      if (active === index && segment === position && !status.textContent) {
        status.textContent = '请点击播放器中的播放按钮。';
      }
    });
  }

  function render() {
    progress.textContent = '已完成 ' + completed.size + ' / ' + lessons.length + ' 堂';
    list.replaceChildren();
    lessons.forEach((lesson, index) => {
      const item = document.createElement('li');
      item.className = 'winter-lesson';
      const title = document.createElement('h3');
      title.textContent = '第 ' + (index + 1) + ' 堂 · ' + lesson.title;
      const detail = document.createElement('p');
      let label = '可观看';
      if (!lesson.playlist.length) label = unavailable ? '视频列表加载失败' : loading ? '正在读取视频' : '视频待上线';
      else if (completed.has(index)) label = '已完成';
      detail.textContent = '培训师：' + lesson.trainer + ' · ' + label +
        (lesson.playlist.length > 1 ? ' · 共 ' + lesson.playlist.length + ' 段' : '');
      item.append(title, detail);
      if (index === guideIndex && lesson.playlist.length > 1) {
        const buttons = document.createElement('div');
        buttons.className = 'winter-video-buttons';
        lesson.playlist.forEach((clip, position) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn ghost';
          button.textContent = '观看' + (clip.title || '视频 ' + (position + 1));
          button.addEventListener('click', () => playSegment(index, position));
          buttons.append(button);
        });
        item.append(buttons);
      } else if (lesson.playlist.length) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn ghost';
        button.textContent = completed.has(index) ? '重看' : '观看课程';
        button.addEventListener('click', () => {
          const position = !completed.has(index) && savedSegments?.lesson === index &&
            savedSegments.playlist === playlistKey(lesson) && Number.isInteger(savedSegments.next) &&
            savedSegments.next > 0 && savedSegments.next < lesson.playlist.length ? savedSegments.next : 0;
          playSegment(index, position);
        });
        item.append(button);
      }
      list.append(item);
    });
  }

  video.addEventListener('error', () => {
    status.textContent = '视频暂时无法播放，请稍后重试。';
  });
  video.addEventListener('ended', () => {
    if (active < 0 || !video.ended || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const lesson = lessons[active];
    if (active === guideIndex && lesson.playlist.length > 1) {
      const playlist = playlistKey(lesson);
      const played = guideProgress?.playlist === playlist && Array.isArray(guideProgress.played)
        ? new Set(guideProgress.played.filter(index => Number.isInteger(index) && index >= 0 && index < lesson.playlist.length))
        : new Set();
      played.add(segment);
      guideProgress = {playlist, played: [...played]};
      if (played.size === lesson.playlist.length) completed.add(active);
      try {
        localStorage.setItem(guideProgressKey, JSON.stringify(guideProgress));
        localStorage.setItem(storageKey, JSON.stringify([...completed]));
      } catch {}
      status.textContent = '本段播放结束。';
      render();
      return;
    }
    if (segment + 1 < lesson.playlist.length) {
      if (!completed.has(active)) {
        savedSegments = {lesson: active, playlist: playlistKey(lesson), next: segment + 1};
        try { localStorage.setItem(segmentKey, JSON.stringify(savedSegments)); } catch {}
      }
      playSegment(active, segment + 1);
      return;
    }
    completed.add(active);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...completed]));
      if (savedSegments?.lesson === active) {
        savedSegments = null;
        localStorage.removeItem(segmentKey);
      }
    } catch { /* In-memory progress still applies. */ }
    status.textContent = '本堂播放结束。';
    render();
  });

  async function loadVideos() {
    loading = true;
    unavailable = false;
    retry.hidden = true;
    render();
    try {
      const videos = await WinterCatalog.list();
      lessons.forEach((lesson, index) => {
        const video = videos[index];
        lesson.playlist = Array.isArray(video?.playlist) ? video.playlist : video?.url ? [video] : [];
      });
    } catch {
      unavailable = true;
      retry.hidden = false;
    } finally {
      loading = false;
      render();
    }
  }
  retry.addEventListener('click', loadVideos);
  loadVideos();
})();
