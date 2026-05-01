const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'WhatsApp Clone API',
    version: '1.0.0',
    description: 'Interactive Swagger UI documentation for the WhatsApp Clone backend APIs.',
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local development server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Health and status endpoints' },
    { name: 'Auth', description: 'Authentication and account endpoints' },
    { name: 'Users', description: 'User lookup and profile endpoints' },
    { name: 'Groups', description: 'Group creation and membership management' },
    { name: 'Messages', description: 'Messaging endpoints' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Not authorized. No token provided.' },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'WhatsApp Clone API is running 🚀' },
          timestamp: { type: 'string', format: 'date-time' },
          environment: { type: 'string', example: 'development' },
        },
      },
      AuthUser: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '665f6c1e7d1f8b0012345678' },
          username: { type: 'string', example: 'john_doe' },
          email: { type: 'string', format: 'email', example: 'john@example.com' },
          avatarColor: { type: 'string', example: '#00a884' },
          isOnline: { type: 'boolean', example: true },
          lastSeen: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      PublicUser: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '665f6c1e7d1f8b0012345678' },
          username: { type: 'string', example: 'john_doe' },
          email: { type: 'string', format: 'email', example: 'john@example.com' },
          avatarColor: { type: 'string', example: '#00a884' },
          avatar: { type: 'string', nullable: true, example: 'https://example.com/avatar.png' },
          isOnline: { type: 'boolean', example: true },
          lastSeen: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Group: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '665f6c1e7d1f8b0012345678' },
          name: { type: 'string', example: 'Weekend Trip Planning' },
          description: { type: 'string', example: 'Planning the Goa trip' },
          avatar: { type: 'string', nullable: true, example: null },
          createdBy: { $ref: '#/components/schemas/PublicUser' },
          members: { type: 'array', items: { $ref: '#/components/schemas/PublicUser' } },
          admins: { type: 'array', items: { $ref: '#/components/schemas/PublicUser' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      GroupCreateRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Weekend Trip Planning' },
          description: { type: 'string', example: 'Planning the Goa trip' },
          avatar: { type: 'string', nullable: true, example: null },
          memberIds: {
            type: 'array',
            items: { type: 'string' },
            example: ['665f6c1e7d1f8b0012345678', '665f6c1e7d1f8b0012345679'],
          },
        },
      },
      GroupRenameRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'New Group Name' },
        },
      },
      GroupMembersRequest: {
        type: 'object',
        required: ['memberIds'],
        properties: {
          memberIds: {
            type: 'array',
            items: { type: 'string' },
            example: ['665f6c1e7d1f8b0012345678', '665f6c1e7d1f8b0012345679'],
          },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Logged in successfully.' },
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          user: { $ref: '#/components/schemas/AuthUser' },
        },
      },
      MessageReference: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '665f6c1e7d1f8b0012345678' },
          username: { type: 'string', example: 'john_doe' },
          avatarColor: { type: 'string', example: '#00a884' },
          avatar: { type: 'string', nullable: true },
        },
      },
      AttachmentMeta: {
        type: 'object',
        nullable: true,
        properties: {
          name: { type: 'string', example: 'photo.jpg' },
          mime: { type: 'string', example: 'image/jpeg' },
          size: { type: 'number', example: 245800 },
          label: { type: 'string', example: 'Office photo' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          sender: { oneOf: [{ type: 'string' }, { $ref: '#/components/schemas/MessageReference' }] },
          receiver: { oneOf: [{ type: 'string' }, { $ref: '#/components/schemas/MessageReference' }] },
          encryptedMessage: { type: 'string', example: 'base64-ciphertext' },
          iv: { type: 'string', example: 'base64-iv' },
          encryptedKey: { type: 'string', nullable: true, example: 'base64-key' },
          messageType: { type: 'string', example: 'text' },
          voiceDuration: { type: 'number', nullable: true, example: 12 },
          attachmentMeta: { $ref: '#/components/schemas/AttachmentMeta' },
          scheduledFor: { type: 'string', format: 'date-time', nullable: true },
          scheduledStatus: { type: 'string', example: 'sent' },
          sentAt: { type: 'string', format: 'date-time', nullable: true },
          deliveredAt: { type: 'string', format: 'date-time', nullable: true },
          readAt: { type: 'string', format: 'date-time', nullable: true },
          editedAt: { type: 'string', format: 'date-time', nullable: true },
          read: { type: 'boolean', example: false },
          pinnedBy: { type: 'array', items: { type: 'string' } },
          starredBy: { type: 'array', items: { type: 'string' } },
          deletedFor: { type: 'array', items: { type: 'string' } },
          forwardedFrom: { oneOf: [{ type: 'string' }, { $ref: '#/components/schemas/MessageReference' }], nullable: true },
          isForwarded: { type: 'boolean', example: false },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ConversationItem: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/PublicUser' },
          lastMessage: { $ref: '#/components/schemas/Message' },
          unreadCount: { type: 'integer', example: 3 },
        },
      },
      SendMessageRequest: {
        type: 'object',
        required: ['encryptedMessage'],
        properties: {
          encryptedMessage: { type: 'string', example: 'base64-ciphertext' },
          iv: { type: 'string', example: 'base64-iv' },
          encryptedKey: { type: 'string', nullable: true, example: 'base64-key' },
          messageType: { type: 'string', example: 'text' },
          voiceDuration: { type: 'number', nullable: true, example: 9 },
          scheduledFor: { type: 'string', format: 'date-time', nullable: true },
          attachmentMeta: { $ref: '#/components/schemas/AttachmentMeta' },
        },
      },
      ForwardMessageRequest: {
        type: 'object',
        required: ['to', 'encryptedMessage'],
        properties: {
          to: { type: 'string', example: '665f6c1e7d1f8b0012345678' },
          encryptedMessage: { type: 'string', example: 'base64-ciphertext' },
          iv: { type: 'string', example: 'base64-iv' },
          encryptedKey: { type: 'string', nullable: true, example: 'base64-key' },
        },
      },
      EditMessageRequest: {
        type: 'object',
        required: ['encryptedMessage'],
        properties: {
          encryptedMessage: { type: 'string', example: 'base64-ciphertext' },
          iv: { type: 'string', example: 'base64-iv' },
          encryptedKey: { type: 'string', nullable: true, example: 'base64-key' },
        },
      },
      DeleteMessageRequest: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['me', 'everyone'], example: 'me' },
        },
      },
      PushTokenRequest: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', example: 'expo-push-token-or-fcm-token' },
        },
      },
      PublicKeyRequest: {
        type: 'object',
        required: ['publicKey'],
        properties: {
          publicKey: { type: 'string', example: '-----BEGIN PUBLIC KEY-----...' },
        },
      },
      SendOtpRequest: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
        },
      },
      VerifyOtpRequest: {
        type: 'object',
        required: ['email', 'otp'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          otp: { type: 'string', example: '123456' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
          username: { type: 'string', example: 'john_doe' },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', example: 'secret123' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', example: 'secret123' },
        },
      },
      GoogleLoginRequest: {
        type: 'object',
        required: ['idToken'],
        properties: {
          idToken: { type: 'string', example: 'firebase-id-token' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Server is running',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/api/auth/send-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Send verification OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/SendOtpRequest' } },
          },
        },
        responses: {
          200: { description: 'OTP sent' },
          400: { description: 'Validation error' },
          500: { description: 'Email/SMTP error' },
        },
      },
    },
    '/api/auth/verify-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Verify OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/VerifyOtpRequest' } },
          },
        },
        responses: {
          200: { description: 'OTP verified' },
          400: { description: 'Validation or OTP error' },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new account after OTP verification',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } },
          },
        },
        responses: {
          201: { description: 'Account created' },
          400: { description: 'Validation or duplicate error' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } },
          },
        },
        responses: {
          200: { description: 'Logged in successfully' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/api/auth/google-login': {
      post: {
        tags: ['Auth'],
        summary: 'Google sign-in with Firebase ID token',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/GoogleLoginRequest' } },
          },
        },
        responses: {
          200: { description: 'Signed in with Google' },
          400: { description: 'Missing ID token' },
          401: { description: 'Invalid token' },
          503: { description: 'Google login not configured' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Current user' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/users/search': {
      get: {
        tags: ['Users'],
        summary: 'Search users by username or email',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Search query',
          },
        ],
        responses: {
          200: {
            description: 'Matching users',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 2 },
                    users: { type: 'array', items: { $ref: '#/components/schemas/PublicUser' } },
                  },
                },
              },
            },
          },
          400: { description: 'Invalid query' },
        },
      },
    },
    '/api/users/public-key': {
      post: {
        tags: ['Users'],
        summary: 'Save my public key',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PublicKeyRequest' } },
          },
        },
        responses: {
          200: { description: 'Public key saved' },
          400: { description: 'Missing publicKey' },
        },
      },
    },
    '/api/users/public-key/{userId}': {
      get: {
        tags: ['Users'],
        summary: 'Get a user public key',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Public key response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    publicKey: { type: 'string', nullable: true },
                    username: { type: 'string' },
                  },
                },
              },
            },
          },
          404: { description: 'User not found' },
        },
      },
    },
    '/api/users': {
      get: {
        tags: ['Users'],
        summary: 'Get all users except self',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Users list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 12 },
                    users: { type: 'array', items: { $ref: '#/components/schemas/PublicUser' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get user by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'User details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    user: { $ref: '#/components/schemas/PublicUser' },
                  },
                },
              },
            },
          },
          404: { description: 'User not found' },
        },
      },
    },
    '/api/users/push-token': {
      post: {
        tags: ['Users'],
        summary: 'Register a push token',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PushTokenRequest' } },
          },
        },
        responses: {
          200: { description: 'Push token registered' },
          400: { description: 'Missing token' },
        },
      },
    },
    '/api/groups': {
      get: {
        tags: ['Groups'],
        summary: 'List groups I belong to',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Groups list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 2 },
                    groups: { type: 'array', items: { $ref: '#/components/schemas/Group' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Groups'],
        summary: 'Create a new group',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/GroupCreateRequest' } },
          },
        },
        responses: {
          201: {
            description: 'Group created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    group: { $ref: '#/components/schemas/Group' },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error' },
          404: { description: 'One or more members not found' },
        },
      },
    },
    '/api/groups/{groupId}': {
      get: {
        tags: ['Groups'],
        summary: 'Get a group by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'groupId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Group details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    group: { $ref: '#/components/schemas/Group' },
                  },
                },
              },
            },
          },
          404: { description: 'Group not found' },
        },
      },
      patch: {
        tags: ['Groups'],
        summary: 'Edit group name',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'groupId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/GroupRenameRequest' } },
          },
        },
        responses: {
          200: {
            description: 'Group renamed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    group: { $ref: '#/components/schemas/Group' },
                  },
                },
              },
            },
          },
          403: { description: 'Only admins can rename the group' },
          404: { description: 'Group not found' },
        },
      },
    },
    '/api/groups/{groupId}/members': {
      post: {
        tags: ['Groups'],
        summary: 'Add members to a group',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'groupId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/GroupMembersRequest' } },
          },
        },
        responses: {
          200: {
            description: 'Members added',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    added: { type: 'integer', example: 2 },
                    group: { $ref: '#/components/schemas/Group' },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error' },
          403: { description: 'Only admins can add members' },
          404: { description: 'Group or users not found' },
        },
      },
      delete: {
        tags: ['Groups'],
        summary: 'Remove members from a group in bulk',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'groupId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/GroupMembersRequest' } },
          },
        },
        responses: {
          200: {
            description: 'Members removed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    removed: { type: 'integer', example: 1 },
                    group: { $ref: '#/components/schemas/Group' },
                  },
                },
              },
            },
          },
          400: { description: 'Validation or creator removal error' },
          403: { description: 'Only admins can remove members' },
          404: { description: 'Group or users not found' },
        },
      },
    },
    '/api/messages/conversations': {
      get: {
        tags: ['Messages'],
        summary: 'List conversations',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Conversation list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    conversations: { type: 'array', items: { $ref: '#/components/schemas/ConversationItem' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/messages/unread': {
      get: {
        tags: ['Messages'],
        summary: 'Get unread counts by sender',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Unread counts map',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    unreadCounts: {
                      type: 'object',
                      additionalProperties: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/messages/starred': {
      get: {
        tags: ['Messages'],
        summary: 'Get starred messages',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Starred message list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 4 },
                    messages: { type: 'array', items: { $ref: '#/components/schemas/Message' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/messages/{userId}/scheduled': {
      get: {
        tags: ['Messages'],
        summary: 'List scheduled messages for a user',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Scheduled messages',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 1 },
                    messages: { type: 'array', items: { $ref: '#/components/schemas/Message' } },
                  },
                },
              },
            },
          },
          404: { description: 'User not found' },
        },
      },
    },
    '/api/messages/scheduled/{messageId}': {
      delete: {
        tags: ['Messages'],
        summary: 'Cancel a scheduled message',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'messageId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Scheduled message cancelled' },
          400: { description: 'Not scheduled or already processed' },
          403: { description: 'Not authorized' },
          404: { description: 'Message not found' },
        },
      },
    },
    '/api/messages/{messageId}/edit': {
      put: {
        tags: ['Messages'],
        summary: 'Edit a message',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'messageId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/EditMessageRequest' } },
          },
        },
        responses: {
          200: { description: 'Message updated' },
          400: { description: 'Validation or edit window error' },
          403: { description: 'Not authorized' },
          404: { description: 'Message not found' },
        },
      },
    },
    '/api/messages/{messageId}/pin': {
      patch: {
        tags: ['Messages'],
        summary: 'Toggle pin on a message',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'messageId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Pin toggled' },
          404: { description: 'Message not found' },
        },
      },
    },
    '/api/messages/{messageId}/star': {
      patch: {
        tags: ['Messages'],
        summary: 'Toggle star on a message',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'messageId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Star toggled' },
          404: { description: 'Message not found' },
        },
      },
    },
    '/api/messages/{messageId}': {
      delete: {
        tags: ['Messages'],
        summary: 'Delete a message for me or everyone',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'messageId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/DeleteMessageRequest' } },
          },
        },
        responses: {
          200: { description: 'Message deleted' },
          400: { description: 'Delete scope error' },
          404: { description: 'Message not found' },
        },
      },
    },
    '/api/messages/{messageId}/forward': {
      post: {
        tags: ['Messages'],
        summary: 'Forward a message',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'messageId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ForwardMessageRequest' } },
          },
        },
        responses: {
          201: { description: 'Message forwarded' },
          400: { description: 'Validation error' },
          404: { description: 'Original message or recipient not found' },
        },
      },
    },
    '/api/messages/{userId}': {
      get: {
        tags: ['Messages'],
        summary: 'Get messages with a user',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Message thread',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 25 },
                    messages: { type: 'array', items: { $ref: '#/components/schemas/Message' } },
                  },
                },
              },
            },
          },
          404: { description: 'User not found' },
        },
      },
      post: {
        tags: ['Messages'],
        summary: 'Send a message to a user',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/SendMessageRequest' } },
          },
        },
        responses: {
          201: { description: 'Message sent' },
          400: { description: 'Validation or encryption error' },
          404: { description: 'Recipient not found' },
        },
      },
    },
  },
}

module.exports = swaggerSpec
