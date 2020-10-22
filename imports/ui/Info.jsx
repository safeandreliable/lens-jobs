import React from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import { Jobs } from '../api/jobs';
export const Info = () => {
  const ready = useTracker(() => Meteor.subscribe('allJobs').ready());
  const jobs = useTracker(() => {
    return Jobs.find().fetch();
  });

  return ready ? (
    <div>
      <h2>Jobs</h2>
      <ul>
        {jobs.map(job => (
          <li key={job._id}>{job.type}</li>
        ))}
      </ul>
    </div>
  ) : (
    'Loading'
  );
};
