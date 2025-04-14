const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'My API',
      version: '1.0.0',
      description: 'API documentation for my Node.js app',
    },
    servers: [
      {
        url: 'http://localhost:3001',
      },
    ],
    components: {
      schemas: {
        Profile: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            profession: { type: 'string', example: 'Engineer' },
            balance: { type: 'number', format: 'float', example: 1000.50 },
            type: { type: 'string', enum: ['client', 'contractor'], example: 'client' }
          }
        },
        Contract: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            terms: { type: 'string', example: 'Work to be done' },
            status: { type: 'string', enum: ['new', 'in_progress', 'terminated'], example: 'in_progress' },
            ClientId: { type: 'integer', example: 1 },
            ContractorId: { type: 'integer', example: 2 }
          }
        },
        Job: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            description: { type: 'string', example: 'Fix bug in app' },
            price: { type: 'number', format: 'float', example: 300.00 },
            paid: { type: 'boolean', example: false },
            paymentDate: { type: 'string', format: 'date-time', example: '2024-04-01T10:00:00Z' },
            ContractId: { type: 'integer', example: 1 }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js'], // Path to your annotated route files
};

const swaggerSpec = swaggerJSDoc(options);

const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};

module.exports = setupSwagger;
