import { authKeycloak } from '@/middleware/auth';
import { AuthenticatedRequest } from '@/types/common';
import { CreatePageRequest } from '@/types/pages';
import { encryptSecret } from '@/utils/crypto';
import { FastifyPluginAsync } from 'fastify';

const pageRoutes: FastifyPluginAsync = async (fastify) => {
  
  // POST /pages - Create a new page
  fastify.post<{
    Body: CreatePageRequest
  }>('/pages', {
    preHandler: [authKeycloak],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'api', 'secret', 'report', 'groups'],
        properties: {
          name: { type: 'string' },
          api: { type: 'string', format: 'uri' },
          secret: { type: 'string' },
          report: { type: 'string' },
          groups: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'alias', 'list'],
              properties: {
                name: { type: 'string' },
                alias: { type: 'string' },
                list: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['name', 'status'],
                    properties: {
                      name: { type: 'string' },
                      status: { type: 'string' },
                      alias: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    
    try {

      const { name, slug, api, secret, report, groups } = request.body as CreatePageRequest;

      const {user} = request as AuthenticatedRequest;
      
      // Basic validation
      if (!name || !api || !user?.sub ||!secret || !report || !groups) {
        reply.code(400);
        return {
          success: false,
          error: 'Missing required fields'
        };
      }
      
      if (!Array.isArray(groups) || groups.length === 0) {
        reply.code(400);
        return {
          success: false,
          error: 'Groups must be a non-empty array'
        };
      }
      
      // Insert into PostgreSQL - use the default pg client
      const client = await (fastify as any).pg.connect();
      
      try {
        const result = await client.query(
          `INSERT INTO pages (name, slug, user_id, api, secret, report, groups, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) 
           RETURNING *`,
          [name, slug, user?.sub, api, encryptSecret(secret), report, JSON.stringify(groups)]
        );
        
        reply.code(201);
        return {
          success: true,
          data: result.rows[0]
        };
      } finally {
        client.release();
      }
      
    } catch (error) {
      fastify.log.error(error);
      
      if (error instanceof Error) {
        if (error.message.includes('duplicate key')) {
          reply.code(400);
          return {
            success: false,
            error: 'Page with this name already exists for this user'
          };
        }
      }
      
      reply.code(500);
      return {
        success: false,
        error: 'Failed to create page'
      };
    }
  });

  // GET /pages/:userId - Get all pages for a user
  fastify.get('/pages', {
    preHandler: [authKeycloak],
  }, async (request, reply) => {
    
    try {

      const {user} = request as AuthenticatedRequest;
      const client = await (fastify as any).pg.connect();
      
      try {
        const result = await client.query(
          'SELECT * FROM pages WHERE user_id = $1 ORDER BY created_at DESC',
          [user?.sub]
        );
        
        return {
          success: true,
          data: result.rows
        };
      } finally {
        client.release();
      }
      
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return {
        success: false,
        error: 'Failed to fetch pages'
      };
    }
  });
};

export default pageRoutes;