const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app/assets/mock-api-live.js', 'utf8');
const uploadSource = source.slice(source.indexOf('const UPLOAD_PART ='), source.indexOf('/* 换 PDF：'));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function harness(options = {}) {
  const calls = [], progress = [], attempts = new Map();
  let active = 0, maxActive = 0, stopped = false;
  const file = {
    name: 'isolated.mp4', size: (options.parts || 7) * 5 * 1024 * 1024 - 17,
    slice(start, end) { return { start, end: Math.min(end, this.size) }; }
  };
  const context = vm.createContext({
    LIVE: { enabled: options.enabled !== false }, AbortController,
    console: { warn() {} },
    setTimeout(fn, ms) { return setTimeout(fn, ms === 120000 ? (options.timeout ? 5 : ms) : 1); },
    clearTimeout,
    async liveApi(action, args) {
      calls.push({ action, ...args, active });
      action=({practiceVideoInit:'uploadInit',practiceVideoSign:'uploadSign',practiceVideoComplete:'uploadComplete',practiceVideoAbort:'uploadClear'})[action]||action;
      if (action === 'uploadInit') {
        stopped = false;
        if (options.initError) throw new Error('init denied');
        return { uploadId: 'isolated-upload', key:'assets/practice-videos/L05-abcdefabcdefabcdefabcdef.mp4' };
      }
      if (action === 'uploadSign') {
        if (options.signError) throw new Error('sign denied');
        const n = (attempts.get(args.partNumber) || 0) + 1;
        attempts.set(args.partNumber, n);
        return { url: `https://isolated.invalid/${args.partNumber}/${n}`, token: `token-${args.partNumber}-${n}` };
      }
      if (action === 'uploadComplete') {
        assert.equal(active, 0, 'merge while requests active');
        if (options.completeError) throw new Error('response lost');
        return { size: file.size };
      }
      if (action === 'uploadClear') {
        assert.equal(active, 0, 'cleanup raced with in-flight PUT');
        stopped = true;
        if (options.cleanupError) throw new Error('cleanup failed');
      }
    },
    async fetch(url, init) {
      assert.equal(stopped, false, 'PUT after cleanup');
      const [pn, n] = url.split('/').slice(-2).map(Number);
      assert.equal(init.headers['x-cos-security-token'], `token-${pn}-${n}`);
      assert.equal(init.method, 'PUT');
      assert.equal(init.body.start, (pn - 1) * 5 * 1024 * 1024);
      assert.equal(init.body.end, Math.min(pn * 5 * 1024 * 1024, file.size));
      active++; maxActive = Math.max(maxActive, active);
      try {
        if (options.timeout) {
          await new Promise((resolve, reject) => init.signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('timeout'), { name: 'AbortError' }));
          }, { once: true }));
        } else {
          await wait(pn === 1 ? 15 : 4); // force out-of-order completion
        }
        if (options.networkError) throw new TypeError('network lost');
        const status = options.status ? options.status(pn, n) : 200;
        return { ok: status === 200, status, headers: { get: () => options.noEtag ? null : `"etag-${pn}"` } };
      } finally { active--; }
    },
    async liveRefresh() { if (options.refreshError) throw new Error('refresh failed'); },
    liveRerender() {},
  });
  vm.runInContext(uploadSource + '\nglobalThis.upload = liveUploadVideo;', context);
  return {
    file, calls, progress, attempts,
    upload: (input = file, cb = (done, total) => progress.push([done, total])) => context.upload(options.practice?'__practice__':'C5', options.practice?(options.levelId||'L05'):'g1', input, cb,{slot:options.slot||0}),
    maxActive: () => maxActive,
  };
}

test('three concurrent PUTs, ordered ETags, monotonic progress and one merge', async () => {
  const h = harness();
  assert.equal((await h.upload()).size, h.file.size);
  assert.equal(h.maxActive(), 3);
  const merges = h.calls.filter(x => x.action === 'uploadComplete');
  assert.equal(merges.length, 1);
  assert.deepEqual(Array.from(merges[0].parts, p => [p.partNumber, p.etag]),
    Array.from({ length: 7 }, (_, i) => [i + 1, `"etag-${i + 1}"`]));
  assert.deepEqual(h.progress, Array.from({ length: 7 }, (_, i) => [i + 1, 7]));
  assert.equal(h.calls.some(x => x.action === 'uploadClear'), false);
});
test('single short final part succeeds', async () => {
  const h = harness({ parts: 1 }); await h.upload(); assert.equal(h.maxActive(), 1);
});
test('transient 503 retries only failed part with fresh paired credentials', async () => {
  const h = harness({ status: (pn, n) => pn === 2 && n === 1 ? 503 : 200 });
  await h.upload(); assert.equal(h.attempts.get(2), 2); assert.equal(h.attempts.get(1), 1);
  assert.equal(h.progress.length, 7);
});
test('429 retries then succeeds', async () => {
  const h = harness({ parts: 1, status: (pn, n) => n < 3 ? 429 : 200 });
  await h.upload(); assert.equal(h.attempts.get(1), 3);
});
test('403 is not retried; no new work or merge; cleanup waits for active PUTs', async () => {
  const h = harness({ status: () => 403 });
  await assert.rejects(h.upload(), /HTTP 403/);
  assert.ok(h.attempts.size <= 3);
  assert.ok([...h.attempts.values()].every(x => x === 1));
  assert.equal(h.calls.filter(x => x.action === 'uploadClear').length, 1);
  assert.equal(h.calls.some(x => x.action === 'uploadComplete'), false);
});
test('persistent network failure stops after three attempts per part', async () => {
  const h = harness({ networkError: true });
  await assert.rejects(h.upload(), /网络中断/);
  assert.ok([...h.attempts.values()].every(x => x <= 3));
  assert.equal(h.calls.filter(x => x.action === 'uploadClear').length, 1);
});
test('stalled PUT times out and performs bounded retries', async () => {
  const h = harness({ timeout: true, parts: 1 });
  await assert.rejects(h.upload(), /超时/); assert.equal(h.attempts.get(1), 3);
});
test('missing ETag fails without retry or merge', async () => {
  const h = harness({ noEtag: true, parts: 1 });
  await assert.rejects(h.upload(), /ETag/); assert.equal(h.attempts.get(1), 1);
});
test('initialization failure does not clear chapter objects', async () => {
  const h = harness({ initError: true }); await assert.rejects(h.upload(), /init denied/);
  assert.deepEqual(h.calls.map(x => x.action), ['uploadInit']);
});
test('sign rejection stops and cleans up without PUT or merge', async () => {
  const h = harness({ signError: true }); await assert.rejects(h.upload(), /sign denied/);
  assert.equal(h.maxActive(), 0);
  assert.equal(h.calls.filter(x => x.action === 'uploadClear').length, 1);
});
test('ambiguous merge response does not delete potentially successful video', async () => {
  const h = harness({ parts: 1, completeError: true });
  await assert.rejects(h.upload(), /合并结果未确认/);
  assert.equal(h.calls.some(x => x.action === 'uploadClear'), false);
});
test('same-chapter duplicate upload is rejected, lock released after success', async () => {
  const h = harness({ parts: 1 }); const first = h.upload();
  await assert.rejects(h.upload(), /正在上传/); await first; await h.upload();
  assert.equal(h.calls.filter(x => x.action === 'uploadInit').length, 2);
});
test('lock released after failure; cleanup error preserves original failure', async () => {
  const h = harness({ parts: 1, status: () => 403, cleanupError: true });
  await assert.rejects(h.upload(), /HTTP 403/); await assert.rejects(h.upload(), /HTTP 403/);
  assert.equal(h.calls.filter(x => x.action === 'uploadInit').length, 2);
});
test('progress callback or refresh error cannot turn success into cleanup', async () => {
  const h = harness({ parts: 1, refreshError: true });
  await h.upload(h.file, () => { throw new Error('detached UI'); });
  assert.equal(h.attempts.get(1), 1);
  assert.equal(h.calls.some(x => x.action === 'uploadClear'), false);
});
test('invalid files and sandbox never reach backend', async () => {
  const h = harness();
  for (const input of [null, { size: 0, name: 'a.mp4' }, { size: 1, name: 'a.txt' }]) {
    await assert.rejects(h.upload(input));
  }
  assert.equal(h.calls.length, 0);
  const sandbox = harness({ enabled: false }); await assert.rejects(sandbox.upload(), /沙盒/);
  assert.equal(sandbox.calls.length, 0);
});

test('practice video upload uses the per-level endpoints and carries the same staged object key',async()=>{
  const h=harness({practice:true,parts:2});
  await h.upload();
  assert.equal(h.calls[0].action,'practiceVideoInit');
  assert.equal(h.calls[0].levelId,'L05');
  assert.equal(h.calls[0].size,h.file.size);
  for(const call of h.calls.slice(1)){
    assert.ok(['practiceVideoSign','practiceVideoComplete'].includes(call.action));
    assert.equal(call.uploadId,'isolated-upload');
    assert.equal(call.key,'assets/practice-videos/L05-abcdefabcdefabcdefabcdef.mp4');
  }
});

test('practice upload failure aborts only its multipart session; oversized files never initialize',async()=>{
  const h=harness({practice:true,parts:2,status:()=>403});
  await assert.rejects(h.upload(),/403/);
  assert.equal(h.calls.at(-1).action,'practiceVideoAbort');
  assert.equal(h.calls.at(-1).uploadId,'isolated-upload');
  const big=harness({practice:true});
  await assert.rejects(big.upload({...big.file,size:3*1024**3}),/2GB/);
  assert.equal(big.calls.length,0);
});

test('all requests for the third high-conversion tutorial retain slot identity',async()=>{
  const h=harness({practice:true,levelId:'L08',slot:2,parts:2});
  await h.upload();
  for(const call of h.calls){assert.equal(call.levelId,'L08');assert.equal(call.slot,2);}
});
