(() => {
  'use strict';
  const lessons = [
    {title: '平台通识与基础账号运营', trainer: '慧欣'},
    {title: '账号起号', trainer: '力丹'},
    {title: '图文爆款 + 截流系统打法', trainer: '孝莺', externalUrl: 'https://meeting.tencent.com/crm/2ZjV31Ydfb'},
    {title: '抖音百万引流爆款视频', trainer: '璐瑶'},
    {title: '导流', trainer: '孝莺'},
  ];
  async function list() {
    const response = await fetch('https://micheal-enviorment1-d0bh1b0787c0.service.tcloudbase.com/etrain', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'winterVideoList'}),
      signal: AbortSignal.timeout(12000),
    });
    const result = await response.json();
    if (!response.ok || !Array.isArray(result?.videos)) throw new Error('暂时无法读取视频列表');
    return result.videos;
  }
  window.WinterCatalog = {lessons, list};
})();
