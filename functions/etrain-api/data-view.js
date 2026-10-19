'use strict';
// Unlisted pages and legacy clients keep the complete snapshot.
const views={
  'admin-courses.html':['courses','users','levels','journey','learn','settings','tasks','trainees','mentors'],
  'admin-perms.html':['users','settings','tasks','trainees','mentors','levels']
};
// Shared by the mentor dashboard, coaching and mentee detail (including readiness).
const mentorPages=new Set(['mentor.html','mentor-coach.html','mentor-mentee.html']);
const mentorKeys=['courses','users','mentors','trainees','levels','journey','learn','settings','tasks','readiness'];
module.exports={
  keysFor(page,role='admin'){
    if(role==='mentor' && mentorPages.has(page))return mentorKeys;
    return role==='admin' && typeof page==='string' && Object.hasOwn(views,page)?views[page]:null;
  },
  publicUsers(role,users){
    if(role!=='admin')return undefined;
    return Object.values(users).map(user=>{
      const {passwordHash,...profile}=user;
      return profile;
    });
  }
};
