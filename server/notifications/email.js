import { NotificationService } from '../notifications';
import { Meteor } from 'meteor/meteor'
// buffer each user's email text in a queue, then flush them in single email
Meteor.startup(() => {
  NotificationService.subscribe('email', (userObj, title, description, activities) => {
    console.log('**Email Notification Service Called**');
    activities.forEach(activity => {
      // add quote to make titles easier to read in email text
      const quoteParams = _.clone(activity.params);
      ['list', 'oldList', 'board', 'comment', 'label', 'card'].forEach(key => {
        if (quoteParams[key]) quoteParams[key] = `"${activity.params[key]}"`; //Removing the quoting of items
      });

      const text = `${activity.params.user} ${TAPi18n.__(activity.description, quoteParams, userObj.getLanguage())}`;
      const itemId = activity.params.itemId || 0;
      activity.params.createdAt = new Date();
      //if the user is not set to archived then we can send the email out
      if (_.isUndefined(userObj.archived) || !userObj.archived) {
        userObj.addEmailBuffer(itemId, text, activity.params);
      }
    });

    // unlike setTimeout(func, delay, args),
    // Meteor.setTimeout(func, delay) does not accept args :-(
    // so we pass userId with closure
    const userId = userObj._id;

    const user = Users.findOne(userId);
    let allowReply = true;
    // for each user, in the timed period, only the first call will get the cached content,
    // other calls will get nothing
    const messages = user.getEmailBuffer();
    if (messages.length === 0) return;
    const card = Cards.findOne({ _id: messages[0].itemId });

    const entities = [];
    // merge the cached content into single email and flush
    let plainText = '';
    const logos = [];
    let breadcrumb = '';
    let primaryLogo = '';
    let timezone = 'UTC';
    const firstItemId = messages[0].itemId;
    messages.forEach(message => {
      const entity = Entities.findOne({ groupName: message.entity });
      plainText += `${message.card}\n${message.url}\n`;
      message.activities.forEach(activity => {
        plainText += `-${activity.text}\n`;
      });
      //if the itemIds are always the same then we can reply
      if (allowReply) allowReply = firstItemId === message.itemId;
      message.emailFrom = `${message.itemId}@${Meteor.myFunctions.systemUrl()}`;
      if (entity) {
        if (entity.settings.timezone) {
          timezone = entity.settings.timezone;
        }
        //get a list of the entities involved in the activity for the subject
        if (!entities.includes(entity.name)) entities.push(entity.name);
        //set the logo, if all same entity, it's the entity logo, else, system
        if (!logos.includes(entity.logo('email'))) logos.push(entity.logo('email'));
      }
    });
    if (logos.length === 1 && logos[0]) {
      primaryLogo = logos[0];
    } else {
      primaryLogo = Meteor.myFunctions.systemEmailLogo();
    }
    const from = allowReply
      ? `${firstItemId}@${Meteor.myFunctions.systemUrl()}`
      : `digest@${Meteor.myFunctions.systemUrl()}`;
    if (allowReply) {
      breadcrumb = card && card.breadcrumb();
      plainText = `Reply above to comment\n${plainText}`;
    }
    SSR.compileTemplate('activityEmail', Assets.getText('email-templates/activity-inlined.html'));
    Template.activityEmail.helpers({
      formatDate(date) {
        const dateFormat = 'ddd, MMM D, YYYY h:mm A z';
        return date ? moment(date).tz(timezone).format(dateFormat) : moment().tz(timezone).format(dateFormat);
      },
    });
    const entityName = entities.join(',');
    const systemName = System.name();
    const emailData = {
      messages,
      allowReply,
      systemUrl: Meteor.myFunctions.systemUrl(),
      primaryLogo,
      secondaryLogo: Meteor.myFunctions.systemSecondaryLogo(),
      entityName,
      systemName,
      breadcrumb,
    };
    const htmlContent = SSR.render('activityEmail', emailData);

    const emailSubject = System.getSetting('EMAIL_SUBJECT', 'LENS');
    const cardName = allowReply && card ? `Notification: ${card.title}` : 'Notification';
    try {
      Email.send({
        to: user.emails[0].address,
        from: `LENS <${from}>`,
        subject: `${emailSubject}  [${systemName} | ${entityName}] Activity ${cardName}`,
        text: plainText,
        html: htmlContent,
      });
      //clear the buffer once we've sent the email
      user.clearEmailBuffer();
    } catch (e) {
      /*eslint-disable*/
      console.error('Error sending notification emails.');
      console.error(e.name);
      console.error(e.message);
      /*eslint-enable*/
      return;
    }
  });
});
