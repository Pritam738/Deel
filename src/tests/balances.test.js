const request = require('supertest');
const app = require('../app');
const { sequelize, Profile, Contract, Job } = require('../model');

jest.mock('../middleware/getProfile', () => ({
  getProfile: jest.fn((req, res, next) => {
    const profileId = req.get('profile_id');
    req.profile = { id: profileId };
    next();
  })
}));

let client, contractor, activeContract, unpaidJob;

beforeEach(async () => {
  await sequelize.sync({ force: true });

  client = await Profile.create({
    firstName: 'Client',
    lastName: 'Test',
    profession: 'Engineer',
    balance: 50,
    type: 'client'
  });

  contractor = await Profile.create({
    firstName: 'Contractor',
    lastName: 'Test',
    profession: 'Designer',
    balance: 0,
    type: 'contractor'
  });

  activeContract = await Contract.create({
    ClientId: client.id,
    ContractorId: contractor.id,
    status: 'in_progress',
    terms: 'Test contract'
  });

  unpaidJob = await Job.create({
    ContractId: activeContract.id,
    description: 'Logo design',
    price: 400,
    paid: false
  });
});

afterAll(async () => {
  await sequelize.close();
});
afterEach(() => {
  jest.restoreAllMocks();
});
describe('POST /balances/deposit/:userId', () => {
  it('should deposit funds if amount is within allowed limit (25%)', async () => {
    const res = await request(app)
      .post(`/balances/deposit/${client.id}`)
      .set('profile_id', client.id)
      .send({ amount: 100 }); // 25% of 400 = 100

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Deposit successful');

    const updatedClient = await Profile.findByPk(client.id);
    expect(Number(updatedClient.balance)).toBe(150); // 50 + 100
  });

  it('should fail if deposit exceeds 25% of unpaid jobs', async () => {
    const res = await request(app)
      .post(`/balances/deposit/${client.id}`)
      .set('profile_id', client.id)
      .send({ amount: 150 }); // 150 > 100

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Deposit exceeds the allowed limit/i);
  });

  it('should return 404 for non-existing client', async () => {
    const res = await request(app)
      .post(`/balances/deposit/9999`)
      .set('profile_id', 9999)
      .send({ amount: 50 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Client not found');
  });

  it('should return 400 for invalid amount', async () => {
    const res = await request(app)
      .post(`/balances/deposit/${client.id}`)
      .set('profile_id', client.id)
      .send({ amount: -10 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid deposit amount');
  });

  it('should return 500 on server error', async () => {
    jest.spyOn(Profile, 'findOne').mockImplementationOnce(() => {
      throw new Error('Database failure');
    });

    const res = await request(app)
      .post(`/balances/deposit/${client.id}`)
      .set('profile_id', client.id)
      .send({ amount: 10 });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
  });
});
