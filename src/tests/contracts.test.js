const request = require('supertest');
const app = require('../app');
const { sequelize, Profile, Contract } = require('../model');
const { getProfile } = require('../middleware/getProfile');

jest.mock('../middleware/getProfile', () => ({
    getProfile: jest.fn((req, res, next) => {
        const profileId = req.get('profile_id');
        req.profile = { id: profileId };
        next();
    })
  }));

  
beforeAll(async () => {
    await sequelize.sync({ force: true });
    const client = await Profile.create({ firstName: 'Client', lastName: 'Test', profession: 'Developer', balance: 100, type: 'client' });
    const contractor = await Profile.create({ firstName: 'Contractor', lastName: 'Test', profession: 'Designer', balance: 200, type: 'contractor' });
    await Contract.create({
      terms: 'Sample contract terms',
      status: 'in_progress',
      ClientId: client.id,
      ContractorId: contractor.id
    });
});

afterAll(async () => {
  await sequelize.close();
});

describe('GET /contracts/:id', () => {

  it('should return 404 if the contract is not found', async () => {
    const response = await request(app)
      .get('/contracts/999999') // Non-existent contract ID
      .set('profile_id', 1); // Assume profile ID 1 is a valid user
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Contract not found');
  });

  it('should return 403 if the user does not own the contract', async () => {
    const response = await request(app)
      .get('/contracts/1')  // Valid contract ID
      .set('profile_id', 999); // Assume profile ID 999 is not the owner of the contract
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Forbidden: You do not own this contract');
  });

  it('should return 200 and the contract if the user is the client or contractor', async () => {
    const client = await Profile.findOne({ where: { type: 'client' } });
    const contractor = await Profile.findOne({ where: { type: 'contractor' } });
    console.log("Test",client.id, contractor.id);
    const responseClient = await request(app)
      .get('/contracts/1') // Valid contract ID
      .set('profile_id', client.id); // Client's profile ID
    expect(responseClient.status).toBe(200);
    expect(responseClient.body).toHaveProperty('id', 1);

    const responseContractor = await request(app)
      .get('/contracts/1') // Valid contract ID
      .set('profile_id', contractor.id); // Contractor's profile ID
    expect(responseContractor.status).toBe(200);
    expect(responseContractor.body).toHaveProperty('id', 1);
  });

  it('should return 500 if there is an internal server error', async () => {
    jest.spyOn(Contract, 'findOne').mockImplementationOnce(() => {
      throw new Error('Internal Server Error');
    });

    const response = await request(app)
      .get('/contracts/1')
      .set('profile_id', 1); // Assume profile ID 1 is a valid user
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal Server Error');
  });
});
