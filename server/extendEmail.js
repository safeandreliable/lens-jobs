Meteor.startup(function() {
  //Bind the old send to new function sendEmail
  const sendEmail = _.bind(Email.send, Email);
  //make email.send use sendGrid if we are in production otherwise SMTP (which should be pointed to mailtrap.io)
  _.extend(Email, {
    send(options) {
      if (Meteor.isProduction) {
        const sgMail = require('@sendgrid/mail');
        //only use sendGrid in production environments
        sgMail.setApiKey(Meteor.settings.private.sendgrid_api_key);
        if (!options.html) options.html = options.text;
        const msg = {
          to: options.to,
          replyTo: options.from,
          from: `noreply@${Meteor.myFunctions.systemUrl()}`,
          subject: options.subject,
          text: options.text,
          html: options.html,
        };
        sgMail
          .send(msg)
          .then(() => {
            /* eslint-disable */
            console.info('Mail sent through SendGrid');
            console.info(`Email sent to: ${options.to}`);
            console.info(`      Subject:${options.subject}`);
          })
          .catch(error => {
            console.error('Error sending email through SendGrid:');
            console.error(error.toString());
            throw error; //toss error up to caller to handle
          });
      } else {
        console.info('Mail sent through SMTP');
        /* eslint-enable */
        options.replyTo = options.from;
        options.from = `noreply@${Meteor.myFunctions.systemUrl()}`;
        sendEmail(options);
      }
    },
  });
});
