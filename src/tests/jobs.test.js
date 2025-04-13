const request = require('supertest');
const app = require('../app');
const { sequelize, Profile, Contract, Job } = require('../model');
const { getProfile } = require('../middleware/getProfile');

jest.mock('../middleware/getProfile', () => ({
  getProfile: jest.fn((req, res, next) => {
    const profileId = req.get('profile_id');
    req.profile = { id: profileId };
    next();
  })
}));

let client, contractor, contract, unpaidJob;

beforeEach(async () => {
  await sequelize.sync({ force: true });

  client = await Profile.create({
    firstName: 'Client',
    lastName: 'Test',
    profession: 'Engineer',
    balance: 500,
    type: 'client'
  });

  contractor = await Profile.create({
    firstName: 'Contractor',
    lastName: 'Test',
    profession: 'Designer',
    balance: 0,
    type: 'contractor'
  });

  contract = await Contract.create({
    ClientId: client.id,
    ContractorId: contractor.id,
    status: 'in_progress',
    terms: 'Test contract'
  });

  unpaidJob = await Job.create({
    ContractId: contract.id,
    description: 'Logo design',
    price: 400,
    paid: false
  });
});

afterAll(async () => {
  await sequelize.close();
});

describe('GET /jobs/unpaid', () => {
  it('should return all unpaid jobs for the client or contractor in active contracts', async () => {
    const response = await request(app)
      .get('/jobs/unpaid')
      .set('profile_id', client.id);  // Client's profile ID

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);  // One unpaid job for the client
    expect(response.body[0]).toHaveProperty('id', unpaidJob.id);
  });

  it('should return unpaid jobs for contractor as well', async () => {
    const response = await request(app)
      .get('/jobs/unpaid')
      .set('profile_id', contractor.id);  // Contractor's profile ID

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);  // One unpaid job for the contractor
    expect(response.body[0]).toHaveProperty('id', unpaidJob.id);
  });

  it('should return 404 if no unpaid jobs found', async () => {
    const newClient = await Profile.create({
      firstName: 'New',
      lastName: 'Client',
      profession: 'Engineer',
      balance: 100,
      type: 'client'
    });

    const response = await request(app)
      .get('/jobs/unpaid')
      .set('profile_id', newClient.id);  // No unpaid jobs for this new client

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('No unpaid jobs found');
  });

  it('should return 500 if an error occurs', async () => {
    jest.spyOn(Job, 'findAll').mockRejectedValueOnce(new Error('Database error'));

    const response = await request(app)
      .get('/jobs/unpaid')
      .set('profile_id', client.id);  // Assume client has unpaid jobs

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal Server Error');
  });
});

describe('POST /jobs/:job_id/pay', () => {
  it('should allow client to pay for an unpaid job', async () => {
    const response = await request(app)
      .post(`/jobs/${unpaidJob.id}/pay`)
      .set('profile_id', client.id)  // Client paying for the job
      .send();

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Payment successful');

    const updatedClient = await Profile.findByPk(client.id);
    const updatedContractor = await Profile.findByPk(contractor.id);
    expect(updatedClient.balance).toBe(100);  // 500 - 400 = 100
    expect(updatedContractor.balance).toBe(400);  // 0 + 400 = 400

    const updatedJob = await Job.findByPk(unpaidJob.id);
    expect(updatedJob.paid).toBe(true);
  });

  it('should return 403 if user is not the client', async () => {
    const response = await request(app)
      .post(`/jobs/${unpaidJob.id}/pay`)
      .set('profile_id', contractor.id)  // Contractor trying to pay (forbidden)
      .send();

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Only the client can pay for the job');
  });

  it('should return 400 if job has already been paid for', async () => {
    await unpaidJob.update({ paid: true });

    const response = await request(app)
      .post(`/jobs/${unpaidJob.id}/pay`)
      .set('profile_id', client.id)  // Client trying to pay for an already paid job
      .send();

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Job already paid for');
  });

  it('should return 400 if client does not have enough balance', async () => {
    const newClient = await Profile.create({
      firstName: 'New Client',
      lastName: 'Test',
      profession: 'Engineer',
      balance: 50,  // Not enough balance
      type: 'client'
    });

    const response = await request(app)
      .post(`/jobs/${unpaidJob.id}/pay`)
      .set('profile_id', newClient.id)  // Client with insufficient balance
      .send();

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Insufficient balance to pay for this job');
  });

  it('should return 404 if the job is not found', async () => {
    const response = await request(app)
      .post(`/jobs/99999/pay`)  // Non-existent job ID
      .set('profile_id', client.id)
      .send();

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Job not found');
  });

  it('should return 500 if there is a server error', async () => {
    jest.spyOn(Job, 'findByPk').mockRejectedValueOnce(new Error('Database error'));

    const response = await request(app)
      .post(`/jobs/${unpaidJob.id}/pay`)
      .set('profile_id', client.id)
      .send();

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal Server Error');
  });
});
