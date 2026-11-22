'use strict';
const createUploader = require('./practice-video.js');

module.exports = function createWinterVideos(deps) {
  const {readJSON, writeJSON, PREFIX} = deps;
  const levels = Array.from({length: 5}, (_, index) => ({
    id: 'L0' + (index + 1),
    title: '寒假特辑 · 第 ' + (index + 1) + ' 堂',
    stages: {practice: true},
  }));
  const manifestPath = id => PREFIX + 'winter-video-' + id + '.json';
  const readLesson = id => readJSON(manifestPath(id), null);
  const uploader = createUploader({
    ...deps,
    objectDirectory: 'assets/winter-videos/',
    async loadForLevel(id) {
      const lesson = levels.find(level => level.id === id);
      if (!lesson) return {levels: [], settings: {}};
      const video = await readLesson(id);
      return {levels: [lesson], settings: {practiceVideos: video ? {[id]: [video]} : {}}};
    },
    async writeJSON(_path, settings, id) {
      const videos = settings.practiceVideos[id];
      await writeJSON(manifestPath(id), videos?.[0] || {});
    },
  });
  const actions = {
    winterVideoInit: 'practiceVideoInit',
    winterVideoSign: 'practiceVideoSign',
    winterVideoComplete: 'practiceVideoComplete',
    winterVideoAbort: 'practiceVideoAbort',
  };
  const sharedCourses = ['C7', 'C4', null, 'C8'];
  function publishedVideo(url, title) {
    if (typeof url !== 'string') return null;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
      return {url: parsed.href, title: typeof title === 'string' ? title.replace(/<[^>]*>/g, '').trim() : ''};
    } catch {
      return null;
    }
  }
  return {
    async list() {
      const [records, courses, settings] = await Promise.all([
        Promise.all(levels.map(level => readLesson(level.id))),
        readJSON(PREFIX + 'courses.json', []),
        readJSON(PREFIX + 'settings.json', {}),
      ]);
      const videos = records.map((record, index) => {
        const uploaded = publishedVideo(record?.url, record?.title);
        if (uploaded) return {...uploaded, playlist: [uploaded]};
        let playlist;
        if (index === 4) {
          const slots = settings?.practiceVideos?.L08;
          if (!Array.isArray(slots) || slots.length < 3) return null;
          playlist = Array.from({length: 3}, (_, slot) => publishedVideo(slots[slot]?.url, '教学视频 ' + (slot + 1)));
        } else {
          const id = sharedCourses[index];
          if (!id) return null;
          const course = courses.find(item => item.id === id);
          const chapters = (course?.chapters || []).filter(chapter => chapter.type === 'video');
          playlist = chapters.map(chapter => publishedVideo(chapter.src, chapter.title));
        }
        if (!playlist.length || playlist.some(video => !video)) return null;
        return {url: playlist[0].url, playlist, source: index === 4 ? '第八关教学视频' : sharedCourses[index]};
      });
      return {videos};
    },
    supports(action) { return Object.hasOwnProperty.call(actions, action); },
    async handle(action, me, data) {
      if (!me || me.role !== 'admin') return {error: '仅管理员可上传寒假视频'};
      const users = await readJSON(PREFIX + 'users.json', {});
      if (users[me.wid]?.role !== 'admin') return {error: '仅管理员可上传寒假视频'};
      return uploader.handle(actions[action], me, {...data, slot: 0});
    },
  };
};
