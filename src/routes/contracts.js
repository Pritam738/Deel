const express = require('express');
const { Contract } = require('../model'); // Adjust the path as necessary
const { getProfile } = require('../middleware/getProfile');
const Sequelize = require('sequelize');

const router = express.Router();

/**
 * @returns contract by id (with authorization check)
 */
router.get('/:id', getProfile, async (req, res) => {
  const { id } = req.params;

  try {
    const contract = await Contract.findOne({ where: { id } });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const userId = Number(req.get('profile_id'))
    if (contract.ClientId !== userId && contract.ContractorId !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this contract' });
    }

    res.json(contract);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @returns list of contracts for the logged-in user (client or contractor)
 * Excludes terminated contracts
 */
router.get('/', getProfile, async (req, res) => {
  const userId = req.profile.id;
  try {
    const contracts = await Contract.findAll({
      where: {
        [Sequelize.Op.or]: [
          { ClientId: userId },
          { ContractorId: userId }
        ],
        status: { [Sequelize.Op.ne]: 'terminated' }
      }
    });

    if (!contracts.length) {
      return res.status(404).json({ error: 'No contracts found' });
    }

    res.json(contracts);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
