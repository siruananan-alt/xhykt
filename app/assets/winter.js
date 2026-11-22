(() => {
  'use strict';

  const lessons = WinterCatalog.lessons.map(lesson => ({...lesson, playlist: []}));
  let loading = true;
  let unavailable = false;
  const storageKey = 'xinghe:winter:2026:completed';
  const segmentKey = storageKey + ':segments';
  let completed = 0;
  let savedSegments = null;
  try {
    const saved = Number(localStorage.getItem(storageKey));
    if (Number.isInteger(saved) && saved >= 0 && saved <= lessons.length) completed = saved;
    savedSegments = JSON.parse(localStorage.getItem(segmentKey));
  } catch {
    // Playback and unlocking still work for the current page without storage.
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
    progress.textContent = '已完成 ' + completed + ' / ' + lessons.length + ' 堂';
    list.replaceChildren();
    lessons.forEach((lesson, index) => {
      const locked = index > completed;
      const item = document.createElement('li');
      item.className = 'winter-lesson';
      item.dataset.state = locked ? 'locked' : 'open';
      const title = document.createElement('h3');
      title.textContent = '第 ' + (index + 1) + ' 堂 · ' + lesson.title;
      const detail = document.createElement('p');
      let label = '可观看';
      if (locked) label = '待解锁 · 看完上一堂后开放';
      else if (index < completed) label = '已完成';
      else if (!lesson.playlist.length) label = unavailable ? '视频列表加载失败' : loading ? '正在读取视频' : '视频待上线';
      detail.textContent = '培训师：' + lesson.trainer + ' · ' + label +
        (lesson.playlist.length > 1 ? ' · 共 ' + lesson.playlist.length + ' 段' : '');
      item.append(title, detail);
      if (!locked && lesson.playlist.length) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn ghost';
        button.textContent = index < completed ? '重看' : '观看课程';
        button.addEventListener('click', () => {
          if (index > completed) return;
          const position = index === completed && savedSegments?.lesson === index &&
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
    let watched = 0;
    for (let i = 0; i < video.played.length; i++) watched += video.played.end(i) - video.played.start(i);
    const tolerance = Math.min(0.75, video.duration * 0.02);
    if (watched < video.duration - tolerance) {
      status.textContent = '请补看跳过的片段，再播放到结尾解锁下一堂。';
      return;
    }
    const lesson = lessons[active];
    if (segment + 1 < lesson.playlist.length) {
      if (active === completed) {
        savedSegments = {lesson: active, playlist: playlistKey(lesson), next: segment + 1};
        try { localStorage.setItem(segmentKey, JSON.stringify(savedSegments)); } catch {}
      }
      playSegment(active, segment + 1);
      return;
    }
    if (active < completed) { status.textContent = '本堂重看结束。'; return; }
    completed++;
    savedSegments = null;
    try {
      localStorage.setItem(storageKey, String(completed));
      localStorage.removeItem(segmentKey);
    } catch { /* In-memory progress still applies. */ }
    status.textContent = completed === lessons.length ? '5 堂课已全部完成。' : '本堂已完成，下一堂已解锁。';
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
