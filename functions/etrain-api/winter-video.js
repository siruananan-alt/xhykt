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
  return {
    async list() {
      const records = await Promise.all(levels.map(level => readLesson(level.id)));
      return {videos: records.map(record => record?.url ? {url: record.url} : null)};
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
