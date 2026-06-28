const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Are You Dead API',
      version: '1.0.0',
      description:
        'Backend API for the Are You Dead safety check-in app. Users are identified by deviceId (no login required).',
    },
    servers: [
      { url: 'https://areuok.onrender.com', description: 'Production (Render)' },
      { url: 'http://localhost:3000', description: 'Local development' },
    ],
    components: {
      schemas: {
        Contact: {
          type: 'object',
          required: ['name', 'phone'],
          properties: {
            name: { type: 'string', example: 'Papa' },
            phone: { type: 'string', example: '+919876543210' },
          },
        },
        ContactsRequest: {
          type: 'object',
          required: ['deviceId', 'user_name', 'contacts'],
          properties: {
            deviceId: {
              type: 'string',
              example: 'c2b3d88b-f45b-4a5c-9c88-75176b6b77e8',
              description: 'Unique device/installation ID from the mobile app',
            },
            user_name: { type: 'string', example: 'User' },
            checkinFrequency: { type: 'string', example: 'Every 24 hours' },
            checkinFrequencyMinutes: { type: 'integer', example: 1440 },
            gracePeriod: { type: 'string', example: '30 minutes' },
            gracePeriodMinutes: { type: 'integer', example: 30 },
            contacts: {
              type: 'array',
              items: { $ref: '#/components/schemas/Contact' },
            },
          },
        },
        ContactsSuccess: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'User and contacts created successfully.' },
            deviceId: { type: 'string', example: 'c2b3d88b-f45b-4a5c-9c88-75176b6b77e8' },
            checkinFrequency: { type: 'string', example: 'Every 24 hours' },
            checkinFrequencyMinutes: { type: 'integer', example: 1440 },
            gracePeriod: { type: 'string', example: '30 minutes' },
            gracePeriodMinutes: { type: 'integer', example: 30 },
          },
        },
        CheckinRequest: {
          type: 'object',
          required: ['deviceId'],
          properties: {
            deviceId: {
              type: 'string',
              example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
            },
          },
        },
        CheckinSuccess: {
          type: 'object',
          properties: {
            message: { type: 'string', example: "Check-in successful. You're marked as SAFE." },
            last_checkin_at: { type: 'string', format: 'date-time', example: '2026-06-20T10:00:00.000Z' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'deviceId is required.' },
          },
        },
      },
    },
    paths: {
      '/api/v1/contacts': {
        post: {
          tags: ['Contacts'],
          summary: 'Save or update emergency contacts',
          description:
            'Creates a new user on first call, or updates settings and contacts for an existing deviceId. Cron alerts fire after checkinFrequencyMinutes + gracePeriodMinutes pass without a check-in.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ContactsRequest' },
              },
            },
          },
          responses: {
            201: {
              description: 'User and contacts created',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ContactsSuccess' } },
              },
            },
            200: {
              description: 'Contacts updated',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ContactsSuccess' } },
              },
            },
            400: {
              description: 'Validation error',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Error' } },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Error' } },
              },
            },
          },
        },
      },
      '/api/v1/checkin': {
        post: {
          tags: ['Check-in'],
          summary: 'Record safety check-in',
          description:
            'Updates last_checkin_at and sets status to SAFE. User must exist (save contacts first).',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CheckinRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Check-in successful',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/CheckinSuccess' } },
              },
            },
            400: {
              description: 'Missing deviceId',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Error' } },
              },
            },
            404: {
              description: 'User not found',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Error' } },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Error' } },
              },
            },
          },
        },
      },
    },
  },
  apis: [],
};

module.exports = swaggerJsdoc(options);
