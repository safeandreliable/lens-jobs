import isNumber from 'lodash/isNumber';
const Jobs = JobCollection('myJobQueue');

Jobs.createJob = function (name, schedule, options) {
  const job = new Job(Jobs, name, options);
  const repeat = isNumber(schedule) ? { repeats: schedule } : { schedule: Jobs.later.parse.text(schedule) };
  job
    .priority('normal')
    .retry({ retries: 5, wait: 15 * 60 * 1000 })
    .repeat(repeat)
    .save();
};
export default Jobs;
