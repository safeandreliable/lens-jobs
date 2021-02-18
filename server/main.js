import { Meteor } from 'meteor/meteor';
import NotificationService from './notifications';
import '/imports/startup/server';
import Jobs from '../imports/api/jobs';

Jobs.allow({
  // Grant full permission to any authenticated user
  admin: function (userId, method, params) {
    return userId ? true : false;
  },
});
Meteor.startup(() => {
  // Normal Meteor publish call, the server always
  // controls what each client can see
  Meteor.publish('allJobs', function () {
    return Jobs.find({ status: { $ne: 'completed' } });
  });
  //check that instant, daily, and weekly notification jobs have been set
  if (
    !Jobs.findOne({
      'data.functionName': 'instantEmailNotifications',
    })
  ) {
    Jobs.createJob('instantEmailNotifications', 'every 1 minute', {
      functionName: 'instantEmailNotifications',
      schedule: 'instant',
    });
  }
  if (
    !Jobs.findOne({
      'data.functionName': 'dailyEmailNotifications',
    })
  ) {
    Jobs.createJob('dailyEmailNotifications', 'at 6:00am', {
      functionName: 'dailyEmailNotifications',
      schedule: 'daily',
    });
  }
  if (
    !Jobs.findOne({
      'data.functionName': 'weeklyEmailNotifications',
    })
  ) {
    Jobs.createJob('weeklyEmailNotifications', 'at 6:00am on Mon', {
      functionName: 'weeklyEmailNotifications',
      schedule: 'weekly',
    });
  }
  // Start the Jobs queue running
  Jobs.startJobServer();
  Jobs.processJobs(
    ['instantEmailNotifications', 'dailyEmailNotifications', 'weeklyEmailNotifications'],
    { pollInterval: 1 * 60 * 1000, workTimeout: 30 * 60 * 1000 },
    function (job, cb) {
      console.info('instant, daily, or weekly Job Found'); //eslint-disable-line
      try {
        NotificationService.processNotificationQueue(job.data.schedule);
        job.done();
      } catch (error) {
        console.error(error); //eslint-disable-line
        job.fail(error);
      }
      cb();
    }
  );
});
