const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app/assets/mentor-courses.js'),'utf8');
const docs=require('../app/assets/document-preview');
const views=require('../functions/etrain-api/data-view');
test('teacher course preview uses the existing ten-table mentor scope only for mentor sessions',()=>{
 assert.equal(views.keysFor('mentor-courses.html','mentor').length,10);
 assert.ok(views.keysFor('mentor-courses.html','mentor').includes('courses'));
 assert.ok(views.keysFor('mentor-courses.html','mentor').includes('settings'));
 assert.equal(views.keysFor('mentor-courses.html','student'),null);
});
test('teacher PDF route stores only a fixed return context and level; existing student links remain unchanged',()=>{
 const base='https://xhykt.work/app/pages/mentor-courses.html?lv=L03&live=1';
 const link=new URL(docs.readerLink('C5',0,{name:'课程资料.pdf',url:'https://files.example/a.pdf'},base,{mentorLevel:'L03'}));
 assert.equal(link.pathname,'/app/pages/pdf-reader.html');assert.equal(link.searchParams.get('from'),'mentor-courses');assert.equal(link.searchParams.get('lv'),'L03');
 assert.equal(link.searchParams.get('c'),'C5');assert.equal(link.searchParams.has('url'),false);
 assert.equal(new URL(docs.readerLink('C5',0,{name:'课程资料.pdf',url:'https://files.example/a.pdf'},base)).searchParams.has('from'),false);
});
test('teacher viewer is independent of all student write helpers',()=>{
 for(const forbidden of ['mockMarkDone','mockSubmitTask','mockReview','mockSubmitSync','gradeQuiz','openPlayer','liveApi('])assert.ok(!source.includes(forbidden),forbidden);
 assert.match(source,/video\.playbackRate/);assert.match(source,/video\.pause\(\)/);assert.match(source,/new MutationObserver/);
 const app=fs.readFileSync(path.join(root,'app/assets/app.js'),'utf8');assert.match(app,/'mentor-courses.html':'mentor'/);
 const ui=fs.readFileSync(path.join(root,'app/assets/ui.js'),'utf8');assert.match(ui,/\['mentor.html','工作台'\],\s*\['mentor-courses.html','课程中心'\]/);
});
