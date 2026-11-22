(() => {
  'use strict';

  const lessons = WinterCatalog.lessons.map(lesson => ({...lesson, video: ''}));
  let loading = true;
  let unavailable = false;
  const storageKey = 'xinghe:winter:2026:completed';
  let completed = 0;
  try {
    const saved = Number(localStorage.getItem(storageKey));
    if (Number.isInteger(saved) && saved >= 0 && saved <= lessons.length) completed = saved;
  } catch {
    // Playback and unlocking still work for the current page without storage.
  }
  let active = -1;
  const list = document.getElementById('winter-list');
  const progress = document.getElementById('winter-progress');
  const player = document.getElementById('winter-player');
  const heading = document.getElementById('winter-playing');
  const video = document.getElementById('winter-video');
  const status = document.getElementById('winter-status');
  const retry = document.getElementById('winter-retry');

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
      else if (!lesson.video) label = unavailable ? '视频列表加载失败' : loading ? '正在读取视频' : '视频待上线';
      detail.textContent = '培训师：' + lesson.trainer + ' · ' + label;
      item.append(title, detail);
      if (!locked && lesson.video) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn ghost';
        button.textContent = index < completed ? '重看' : '观看课程';
        button.addEventListener('click', () => {
          if (index > completed) return;
          player.hidden = false;
          if (active !== index) {
            active = index;
            heading.textContent = lesson.title;
            status.textContent = '';
            video.src = lesson.video;
          }
          heading.focus();
          video.play().catch(() => {
            if (active === index && !status.textContent) status.textContent = '请点击播放器中的播放按钮。';
          });
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
    if (active !== completed || !video.ended || !Number.isFinite(video.duration) || video.duration <= 0) return;
    let watched = 0;
    for (let i = 0; i < video.played.length; i++) watched += video.played.end(i) - video.played.start(i);
    const tolerance = Math.min(0.75, video.duration * 0.02);
    if (watched < video.duration - tolerance) {
      status.textContent = '请补看跳过的片段，再播放到结尾解锁下一堂。';
      return;
    }
    completed++;
    try { localStorage.setItem(storageKey, String(completed)); } catch { /* In-memory progress still applies. */ }
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
      lessons.forEach((lesson, index) => { lesson.video = videos[index]?.url || ''; });
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
