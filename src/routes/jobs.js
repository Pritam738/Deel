const express = require('express');
const { Job, Contract, Profile } = require('../model');
const { getProfile } = require('../middleware/getProfile');
const Sequelize = require('sequelize');

const router = express.Router();
/**
 * @swagger
 * tags:
 *   name: Jobs
 *   description: Job-related endpoints
 */

/**
 * @swagger
 * /jobs/unpaid:
 *   get:
 *     summary: Get all unpaid jobs for the logged-in user with active contracts
 *     tags: [Jobs]
 *     parameters:
 *       - in: header
 *         name: profile_id
 *         required: true
 *         description: ID of the profile making the request
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: List of unpaid jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Job'
 *       404:
 *         description: No unpaid jobs found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "No unpaid jobs found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal Server Error"
 */

router.get('/unpaid', getProfile, async (req, res) => {
  const id = Number(req.get('profile_id'));
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
 * @swagger
 * /jobs/{job_id}/pay:
 *   post:
 *     summary: Pay for a specific job
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: job_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the job to pay for
 *       - in: header
 *         name: profile_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the profile making the payment (must be the client)
 *     responses:
 *       200:
 *         description: Payment successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Payment successful"
 *       400:
 *         description: Job already paid or insufficient balance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Insufficient balance to pay for this job"
 *       403:
 *         description: Forbidden - only the client can pay for the job
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Only the client can pay for the job"
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Job not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal Server Error"
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
