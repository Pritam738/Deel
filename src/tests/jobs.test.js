const request = require('supertest');
const app = require('../app'); // Adjust path to your Express app
const { sequelize, Profile, Contract, Job } = require('../model');
const { getProfile } = require('../middleware/getProfile');

jest.mock('../middleware/getProfile', () => ({
  getProfile: jest.fn((req, res, next) => {
    const profileId = req.get('profile_id');
    req.profile = { id: Number(profileId) };
    next();
  })
}));

beforeAll(async () => {
  await sequelize.sync({ force: true });
  // Create test data
  const client = await Profile.create({
    firstName: 'Client',
    lastName: 'Test',
    profession: 'Developer',
    balance: 1000,
    type: 'client',
  });
  const contractor = await Profile.create({
    firstName: 'Contractor',
    lastName: 'Test',
    profession: 'Designer',
    balance: 500,
    type: 'contractor',
  });

  const contract = await Contract.create({
    terms: 'Sample contract terms',
    status: 'in_progress',
    ClientId: client.id,
    ContractorId: contractor.id,
  });

  await Job.create({
    description: 'Unpaid job',
    price: 200,
    paid: null,
    ContractId: contract.id,
  });

  await Job.create({
    description: 'Paid job',
    price: 300,
    paid: true,
    paymentDate: new Date(),
    ContractId: contract.id,
  });

  // Another contract with no jobs
  await Contract.create({
    terms: 'Empty contract',
    status: 'in_progress',
    ClientId: client.id,
    ContractorId: contractor.id,
  });
});

afterAll(async () => {
  await sequelize.close();
});

describe('GET /jobs/unpaid', () => {
  it('should return unpaid jobs for the client', async () => {
    const client = await Profile.findOne({ where: { type: 'client' } });

    const response = await request(app)
      .get('/jobs/unpaid')
      .set('profile_id', client.id);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toHaveProperty('description', 'Unpaid job');
    expect(response.body[0]).toHaveProperty('price', 200);
    expect(response.body[0]).toHaveProperty('paid', null);
  });

  it('should return 404 if no unpaid jobs are found', async () => {
    const client = await Profile.findOne({ where: { type: 'client' } });
    // Mark all jobs as paid
    await Job.update({ paid: true, paymentDate: new Date() }, { where: { paid: null } });

    const response = await request(app)
      .get('/jobs/unpaid')
      .set('profile_id', client.id);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('No unpaid jobs found');
  });

  it('should return 500 if there is an internal server error', async () => {
    jest.spyOn(Job, 'findAll').mockImplementationOnce(() => {
      throw new Error('Database error');
    });

    const client = await Profile.findOne({ where: { type: 'client' } });

    const response = await request(app)
      .get('/jobs/unpaid')
      .set('profile_id', client.id);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal Server Error');
  });
});

describe('POST /jobs/:job_id/pay', () => {
  beforeEach(async () => {
    // Reset jobs to ensure unpaid job exists for each test
    await Job.destroy({ where: {} });
    const contract = await Contract.findOne({ where: { terms: 'Sample contract terms' } });
    await Job.create({
      description: 'Unpaid job',
      price: 200,
      paid: null,
      ContractId: contract.id,
    });
    await Job.create({
      description: 'Paid job',
      price: 300,
      paid: true,
      paymentDate: new Date(),
      ContractId: contract.id,
    });
  });

  it('should allow client to pay for an unpaid job', async () => {
    const client = await Profile.findOne({ where: { type: 'client' } });
    const job = await Job.findOne({ where: { paid: null } });

    const response = await request(app)
      .post(`/jobs/${job.id}/pay`)
      .set('profile_id', client.id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Payment successful' });

    // Verify job is paid
    const updatedJob = await Job.findByPk(job.id);
    expect(updatedJob.paid).toBe(true);
    expect(updatedJob.paymentDate).not.toBeNull();

    // Verify balances
    const updatedClient = await Profile.findByPk(client.id);
    const contractor = await Profile.findOne({ where: { type: 'contractor' } });
    expect(updatedClient.balance).toBe(800); // 1000 - 200
    expect(contractor.balance).toBe(700); // 500 + 200
  });

  it('should return 404 if the job is not found', async () => {
    const client = await Profile.findOne({ where: { type: 'client' } });

    const response = await request(app)
      .post('/jobs/999/pay')
      .set('profile_id', client.id);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Job not found');
  });

  it('should return 403 if the user is not the client', async () => {
    const contractor = await Profile.findOne({ where: { type: 'contractor' } });
    const job = await Job.findOne({ where: { paid: null } });

    const response = await request(app)
      .post(`/jobs/${job.id}/pay`)
      .set('profile_id', contractor.id);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Only the client can pay for the job');
  });

  it('should return 400 if the job is already paid', async () => {
    const client = await Profile.findOne({ where: { type: 'client' } });
    const job = await Job.findOne({ where: { paid: true } });

    const response = await request(app)
      .post(`/jobs/${job.id}/pay`)
      .set('profile_id', client.id);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Job already paid for');
  });

  it('should return 400 if client has insufficient balance', async () => {
    const client = await Profile.findOne({ where: { type: 'client' } });
    await client.update({ balance: 100 }); // Set balance below job price
    const job = await Job.findOne({ where: { paid: null } });

    const response = await request(app)
      .post(`/jobs/${job.id}/pay`)
      .set('profile_id', client.id);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Insufficient balance to pay for this job');
  });

  it('should return 500 if there is an internal server error', async () => {
    jest.spyOn(Job, 'findByPk').mockImplementationOnce(() => {
      throw new Error('Database error');
    });

    const client = await Profile.findOne({ where: { type: 'client' } });
    const job = await Job.findOne({ where: { paid: null } });

    const response = await request(app)
      .post(`/jobs/${job.id}/pay`)
      .set('profile_id', client.id);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal Server Error');
  });
});