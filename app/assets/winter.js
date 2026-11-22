(() => {
  'use strict';

  // Add the approved public video URL for each lesson when it is ready.
  const lessons = [
    { title: '平台通识与基础账号运营', trainer: '慧欣', video: '' },
    { title: '账号起号', trainer: '力丹', video: '' },
    { title: '图文爆款 + 截流系统打法', trainer: '孝莺', video: '' },
    { title: '抖音百万引流爆款视频', trainer: '璐瑶', video: '' },
    { title: '导流', trainer: '孝莺', video: '' },
  ];
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
      else if (!lesson.video) label = '视频待上线';
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

  render();
})();
