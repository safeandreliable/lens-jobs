import { Notifications } from '../imports/api/notifications';
import { Meteor } from 'meteor/meteor';
// a map of notification service, like email, web, IM, qq, etc.

// serviceName -> callback(user, title, description, params)
// expected arguments to callback:
// - user: Meteor user object
// - title: String, TAPi18n key
// - description, String, TAPi18n key
// - params: Object, values extracted from context, to used for above two TAPi18n keys
//   see example call to NotificationService.notify() in models/activities.js
const notifyServices = {};
const Users = Meteor.users;
NotificationService = {
  subscribe: (serviceName, callback) => {
    notifyServices[serviceName] = callback;
  },

  unsubscribe: serviceName => {
    if (typeof notifyServices[serviceName] === 'function') delete notifyServices[serviceName];
  },

  // filter recipients according to user settings for notification
  getUsers: (participants, watchers, managers) => {
    const userMap = {};
    participants.forEach(userId => {
      if (userMap[userId]) return;
      const user = Users.findOne(userId);
      // check the user is valid, is signed up for notifications and not archived
      if (user && user.hasTag('notify-participate') && !user.archived) {
        userMap[userId] = user;
      }
    });
    watchers.forEach(userId => {
      if (userMap[userId]) return;
      const user = Users.findOne(userId);
      // check the user is valid, is signed up for notifications and not archived
      if (user && user.hasTag('notify-watch') && !user.archived) {
        userMap[userId] = user;
      }
    });
    managers.forEach(userId => {
      if (userMap[userId]) return;
      const user = Users.findOne(userId);
      // check the user is valid, is signed up for notifications and not archived
      if (user && !user.archived) {
        userMap[userId] = user;
      }
    });
    return _.map(userMap, v => v);
  },

  queueNotification: (user, title, description, params) => {
    const userId = user._id;

    const activity = {
      title,
      description,
      params,
    };
    //check if there is an existing notification queued up for this user
    const existingNotification = Notifications.findOne({
      'details.userId': userId,
      processed: false,
      frequency: { $ne: 'failed' },
    });
    if (existingNotification) {
      // console.log(`existingNotification:${JSON.stringify(existingNotification)}`); //eslint-disable-line
      existingNotification.details.activities.push(activity);
      Notifications.update(existingNotification._id, {
        $set: { 'details.activities': existingNotification.details.activities },
      });
    } else {
      Notifications.insert({
        frequency: user.profile.notifyFrequency ? user.profile.notifyFrequency : 'instant',
        details: {
          userId: user._id,
          activities: [activity],
        },
      });
    }
  },

  processNotificationQueue: frequency => {
    console.info('Processing Queue');
    Notifications.find({
      frequency,
      processed: false,
    }).forEach(notification => {
      try {
        notification.details.frequency = frequency;
        NotificationService.sendNotify(notification.details);
        Notifications.update({ _id: notification._id }, { $set: { processed: true } });
      } catch (err) {
        console.error(err); //eslint-disable-line
        Notifications.update(
          { _id: notification._id },
          { $set: { processed: false, frequency: 'failed', 'details.error': `${err.name}:${err.message}` } }
        );
      }
    });
  },

  sendNotify: details => {
    console.log('sending notification');
    console.log(`details:${JSON.stringify(details)}`);//eslint-disable-line
    const user = Users.findOne(details.userId);
    console.log(`notifyServices:${JSON.stringify(notifyServices)}`);//eslint-disable-line
    for (const k in notifyServices) {
      const notifyImpl = notifyServices[k];
      if (notifyImpl && typeof notifyImpl === 'function') {
        /*eslint-disable*/
        console.info(`Sending ${details.frequency} ${k} notification to: ${user._id} : ${user.username}`);
        console.info(`                  Details:${JSON.stringify(details)} `);
        /*eslint-enable*/
        notifyImpl(user, details.title, details.description, details.activities);
        console.info('Notification Sent'); //eslint-disable-line
      }
    }
  },
};

export default NotificationService;
