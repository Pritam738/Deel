const express = require('express');
const { sequelize, Profile, Contract, Job } = require('../model');
const { getProfile } = require('../middleware/getProfile');

const router = express.Router();

router.post('/deposit/:userId', getProfile, async (req, res) => {
  const { userId } = req.params;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid deposit amount' });
  }

  try {
    const client = await Profile.findOne({ where: { id: userId, type: 'client' } });
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const unpaidJobs = await Job.findAll({
      where: {
        paid: false
      },
      include: {
        model: Contract,
        required: true,
        where: {
          ClientId: client.id,
          status: 'in_progress'
        }
      }
    });

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
