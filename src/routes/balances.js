const express = require('express');
const { sequelize, Profile, Contract, Job } = require('../model');
const { getProfile } = require('../middleware/getProfile');
const Sequelize = require('sequelize');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Balances
 *   description: Balance-update-related endpoints
 */

/**
 * @swagger
 * /balances/deposit/{userId}:
 *   post:
 *     summary: Deposit funds into the balance for a specific user
 *     tags: [Balances]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: ID of the user to deposit funds for
 *         schema:
 *           type: integer
 *       - in: header
 *         name: profile_id
 *         required: true
 *         description: The profile ID of the logged-in user making the request
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 format: float
 *                 description: Amount to be deposited
 *                 example: 10
 *     responses:
 *       200:
 *         description: Deposit successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Deposit successful
 *                 balance:
 *                   type: number
 *                   format: float
 *                   example: 110
 *       400:
 *         description: Invalid deposit amount or exceeds allowed limit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid deposit amount
 *       403:
 *         description: Forbidden - Cannot deposit to another user's account
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: You can only deposit to your own account
 *       404:
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Client not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal Server Error
 */

router.post('/deposit/:userId', getProfile, async (req, res) => {
  const { userId } = req.params;
  const { amount } = req.body;
  const id = Number(req.get('profile_id'));

  if (id !== Number(userId)) {
    return res.status(403).json({ error: 'You can only deposit to your own account' });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid deposit amount' });
  }

  try {
    const client = await Profile.findOne({ where: { id: userId, type: 'client' } });
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const unpaidJobs = await Job.findAll({
      where: {
        paid: {
          [Sequelize.Op.or]: [null, false],
        },
        '$Contract.status$': 'in_progress',      },
      include: {
        model: Contract,
        required: true,
        where: {
          ClientId: client.id,
          status: 'in_progress'
        }
      }
    });
    console.log('Unpaid Jobs:', unpaidJobs);
    if (unpaidJobs.length === 0) {
      return res.status(400).json({ error: 'No unpaid jobs found' });
    }
    const totalToPay = unpaidJobs.reduce((sum, job) => sum + parseFloat(job.price), 0);
    const maxAllowed = totalToPay * 0.25;

    if (amount > maxAllowed) {
      return res.status(400).json({
        error: `Deposit exceeds the allowed limit. Max allowed: ${maxAllowed}`
      });
    }

    await sequelize.transaction(async (t) => {
      client.balance = parseFloat(client.balance) + parseFloat(amount);
      await client.save({ transaction: t });
    });

    res.json({ message: 'Deposit successful', balance: client.balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
