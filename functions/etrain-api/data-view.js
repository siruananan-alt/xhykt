'use strict';
// Unlisted pages and legacy clients keep the complete snapshot.
const views={
  'admin-courses.html':['courses','users','levels','journey','learn','settings','tasks','trainees','mentors'],
  'admin-perms.html':['users','settings','tasks','trainees','mentors','levels']
};
module.exports={
  keysFor(page){return typeof page==='string' && Object.hasOwn(views,page)?views[page]:null;},
  publicUsers(role,users){
    if(role!=='admin')return undefined;
    return Object.values(users).map(user=>{
      const {passwordHash,...profile}=user;
      return profile;
    });
  }
};
