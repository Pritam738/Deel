const request = require('supertest');
const app = require('../app');
const { sequelize, Profile, Contract, Job } = require('../model');
const { getProfile } = require('../middleware/getProfile');

jest.mock('../middleware/getProfile', () => ({
  getProfile: jest.fn((req, res, next) => {
    const profileId = req.get('profile_id');
    req.profile = { id: parseInt(profileId) };
    next();
  })
}));

let client, contractor;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  client = await Profile.create({
    firstName: 'John',
    lastName: 'Client',
    profession: 'Manager',
    balance: 1000,
    type: 'client'
  });

  contractor = await Profile.create({
    firstName: 'Jane',
    lastName: 'Contractor',
    profession: 'Engineer',
    balance: 500,
    type: 'contractor'
  });

  const contract = await Contract.create({
    terms: 'A test contract',
    status: 'in_progress',
    ClientId: client.id,
    ContractorId: contractor.id
  });

  await Job.bulkCreate([
    {
      description: 'Job 1',
      price: 200,
      paid: true,
      paymentDate: '2022-05-15',
      ContractId: contract.id
    },
    {
      description: 'Job 2',
      price: 300,
      paid: true,
      paymentDate: '2022-06-20',
      ContractId: contract.id
    },
    {
      description: 'Job 3 - Unpaid',
      price: 500,
      paid: false,
      ContractId: contract.id
    }
  ]);
});

afterAll(async () => {
  await sequelize.close();
});

describe('GET /admin/best-profession', () => {
  it('should return the top earning profession within the given date range', async () => {
    const response = await request(app)
      .get('/admin/best-profession?start=2022-01-01&end=2022-12-31')
      .set('profile_id', client.id);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('profession', contractor.profession);
    expect(parseFloat(response.body.totalEarnings)).toBeCloseTo(500);
  });

  it('should return 400 if dates are missing', async () => {
    const response = await request(app)
      .get('/admin/best-profession')
      .set('profile_id', client.id);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});

describe('GET /admin/best-clients', () => {
  it('should return the top paying client(s)', async () => {
    const response = await request(app)
      .get('/admin/best-clients?start=2022-01-01&end=2022-12-31&limit=1')
      .set('profile_id', contractor.id);

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0]).toMatchObject({
      id: client.id,
      fullName: `${client.firstName} ${client.lastName}`
    });
    expect(parseFloat(response.body[0].paid)).toBeCloseTo(500);
  });

  it('should return 400 if dates are missing', async () => {
    const response = await request(app)
      .get('/admin/best-clients')
      .set('profile_id', contractor.id);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should default to limit=2 when not provided', async () => {
    const response = await request(app)
      .get('/admin/best-clients?start=2022-01-01&end=2022-12-31')
      .set('profile_id', contractor.id);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeLessThanOrEqual(2);
  });
});
