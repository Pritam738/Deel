const express = require('express');
const Sequelize = require('sequelize');
const { Job, Profile, Contract } = require('../model');
const router = express.Router();

router.get('/best-profession', async (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: 'start and end date are required' });
  }

  const jobs = await Job.findAll({
    where: {
      paid: true,
      paymentDate: {
        [Sequelize.Op.between]: [new Date(start), new Date(end)]
      }
    },
    include: {
      model: Contract,
      include: {
        model: Profile,
        as: 'Contractor'
      }
    }
  });

  const earningsByProfession = {};

  jobs.forEach(job => {
    const profession = job.Contract.Contractor.profession;
    const amount = parseFloat(job.price);

    if (!earningsByProfession[profession]) {
      earningsByProfession[profession] = 0;
    }

    earningsByProfession[profession] += amount;
  });

  const bestProfession = Object.entries(earningsByProfession)
    .sort((a, b) => b[1] - a[1])[0];

  if (!bestProfession) return res.status(404).json({ error: 'No profession found in given range' });

  res.json({ profession: bestProfession[0], totalEarnings: bestProfession[1] });
});

router.get('/best-clients', async (req, res) => {
  const { start, end, limit = 2 } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: 'start and end date are required' });
  }

  const jobs = await Job.findAll({
    where: {
      paid: true,
      paymentDate: {
        [Sequelize.Op.between]: [new Date(start), new Date(end)]
      }
    },
    include: {
      model: Contract,
      include: {
        model: Profile,
        as: 'Client'
      }
    }
  });

  const paymentsByClient = {};

  jobs.forEach(job => {
    const client = job.Contract.Client;
    const amount = parseFloat(job.price);

    if (!paymentsByClient[client.id]) {
      paymentsByClient[client.id] = {
        id: client.id,
        fullName: `${client.firstName} ${client.lastName}`,
        paid: 0
      };
    }

    paymentsByClient[client.id].paid += amount;
  });

  const topClients = Object.values(paymentsByClient)
    .sort((a, b) => b.paid - a.paid)
    .slice(0, parseInt(limit));

  res.json(topClients);
});

module.exports = router;
