(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const rows = document.getElementById('winter-video-rows');
    if (!rows) return;
    const fields = WinterCatalog.lessons.map((lesson, index) => {
      const form = document.createElement('form');
      form.className = 'card';
      form.innerHTML = '<h3></h3><p class="hint" role="status">正在读取视频状态…</p>' +
        '<label>选择 MP4 <input type="file" accept=".mp4,video/mp4" required></label> ' +
        '<button type="submit" class="btn sm" disabled>上传并发布</button>';
      const [heading, status, , button] = form.children;
      const input = form.querySelector('input');
      heading.textContent = '第 ' + (index + 1) + ' 堂 · ' + lesson.title + '（' + lesson.trainer + '）';
      let published = false;
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (button.disabled) return;
        const file = input.files[0];
        if (!file) return;
        if (published && !window.confirm('替换后，公开专区将播放新视频。确定上传并发布吗？')) return;
        button.disabled = input.disabled = true;
        status.textContent = '正在准备上传…';
        try {
          const result = await window.liveUploadVideo('__winter__', 'L0' + (index + 1), file, (done, total) => {
            status.textContent = done === total ? '正在核对并发布…' : '已上传 ' + Math.round(done / total * 100) + '%';
          });
          if (!result?.ok) throw new Error('未收到发布确认');
          published = true;
          form.reset();
          status.textContent = '已发布，访客可以在公开专区观看。';
          button.textContent = '替换并发布';
        } catch (error) {
          status.textContent = '上传未确认：' + error.message + '。请刷新核对发布状态后再试。';
        } finally {
          button.disabled = input.disabled = false;
        }
      });
      rows.append(form);
      return {
        update(record, failed) {
          published = Boolean(record);
          status.textContent = failed ? '暂时无法核对视频状态，请刷新重试。' :
            published ? (record.source ? '已发布 · 复用 ' + record.source + ' · ' + record.playlist.length + ' 段' : '已发布') :
              lesson.externalUrl ? '已提供腾讯会议观看入口' : '未上传';
          button.textContent = published ? '替换并发布' : '上传并发布';
          button.disabled = failed;
        },
      };
    });
    WinterCatalog.list().then(videos => {
      fields.forEach((field, index) => field.update(videos[index], false));
    }).catch(() => fields.forEach(field => field.update(null, true)));
  });
})();
