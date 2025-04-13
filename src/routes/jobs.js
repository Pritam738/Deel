const express = require('express');
const { Job, Contract, Profile } = require('../model');
const { getProfile } = require('../middleware/getProfile');
const Sequelize = require('sequelize');

const router = express.Router();

/**
 * @route GET /jobs/unpaid
 * @desc Get all unpaid jobs for a user (either client or contractor) in active contracts
 * @access Public (You can change this based on your needs)
 */
router.get('/unpaid', getProfile, async (req, res) => {
  const id = Number(req.get('profile_id'))
  console.log('User ID:', id); // Log the user ID for debugging 
  try {
    const unpaidJobs = await Job.findAll({
      where: {
        paid: null,
        '$Contract.status$': 'in_progress',
      },
      include: {
        model: Contract,
        where: {
            ClientId: id
        },
        required: true,
      },
    });

    if (!unpaidJobs.length) {
      return res.status(404).json({ error: 'No unpaid jobs found' });
    }

    res.json(unpaidJobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @route POST /jobs/:job_id/pay
 * @desc Pay for a job
 * @access Private (Only for clients)
 */
router.post('/:job_id/pay', getProfile, async (req, res) => {
  const { job_id } = req.params;
  const clientId = Number(req.get('profile_id'))

  try {
    const job = await Job.findByPk(job_id, {
      include: {
        model: Contract,
        required: true,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.Contract.ClientId !== clientId) {
      return res.status(403).json({ error: 'Only the client can pay for the job' });
    }

    if (job.paid === 1) {
      return res.status(400).json({ error: 'Job already paid for' });
    }

    const client = await Profile.findByPk(clientId);
    if (client.balance < job.amountDue) {
      return res.status(400).json({ error: 'Insufficient balance to pay for this job' });
    }

    const contractor = await Profile.findByPk(job.Contract.ContractorId);

    await client.update({ balance: client.balance - job.amountDue });
    await contractor.update({ balance: contractor.balance + job.amountDue });

    await job.update({ paid: 1, paymentDate: new Date() });

    res.json({ message: 'Payment successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
