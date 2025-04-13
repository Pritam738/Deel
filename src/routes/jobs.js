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
  try {
    const unpaidJobs = await Job.findAll({
      where: {
        paid: {
          [Sequelize.Op.or]: [null, false],
        },
        '$Contract.status$': 'in_progress',
      },
      include: {
        model: Contract,
        where: {
          [Sequelize.Op.or]: [
            { ClientId: id },
            { ContractorId: id }
          ]
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
  const clientId = Number(req.get('profile_id'));

  const transaction = await Job.sequelize.transaction();
  try {
    const job = await Job.findOne({
      where: { id: job_id },
      include: {
        model: Contract,
        required: true
      },
      transaction
    });

    if (!job) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.Contract.ClientId !== clientId) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Only the client can pay for the job' });
    }

    if (job.paid === true) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Job already paid for' });
    }

    const client = await Profile.findByPk(clientId, { transaction });
    if (client.balance < job.price) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Insufficient balance to pay for this job' });
    }

    const contractor = await Profile.findByPk(job.Contract.ContractorId, { transaction });

    client.balance -= job.price;
    contractor.balance += job.price;

    await client.save({ transaction });
    await contractor.save({ transaction });

    job.paid = true;
    job.paymentDate = new Date();
    await job.save({ transaction });

    await transaction.commit();
    res.json({ message: 'Payment successful' });
  } catch (error) {
    console.error(error);
    await transaction.rollback();
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


module.exports = router;
